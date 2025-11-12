// screens/EmployerProfileScreen.js
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { Image } from 'expo-image';
import { supabase } from '../supabaseClient';

const AVATAR_PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

// Bucket & Pfad aus Supabase-Storage-URL ziehen
function extractBucketAndPath(urlOrPath) {
  if (!urlOrPath) return null;

  // Reiner Pfad "<bucket>/<path...>"
  if (!/^https?:\/\//i.test(urlOrPath)) {
    const firstSlash = urlOrPath.indexOf('/');
    if (firstSlash === -1) return null;
    return {
      bucket: urlOrPath.slice(0, firstSlash),
      path: urlOrPath.slice(firstSlash + 1),
    };
  }

  // Volle URL aus Supabase Storage
  const m = urlOrPath.match(
    /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/i
  );
  if (m) return { bucket: m[1], path: m[2] };
  return null;
}

export default function EmployerProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // kann aus Tabs kommen
  const sessionFromParams = route?.params?.session ?? null;
  const [session, setSession] = useState(sessionFromParams);
  const [loadingSession, setLoadingSession] = useState(!sessionFromParams);

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [activeJobCount, setActiveJobCount] = useState(null);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Avatar
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [signedAvatarUrl, setSignedAvatarUrl] = useState(null);

  // ------- Session nachladen --------
  useEffect(() => {
    if (!session) {
      (async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session) setSession(data.session);
        setLoadingSession(false);
      })();
    } else {
      setLoadingSession(false);
    }
  }, [session]);

  // erstes Laden
  useEffect(() => {
    if (!session?.user?.id) return;
    fetchProfile();
    fetchActiveJobCount();
  }, [session?.user?.id]);

  // beim Zurückkommen neu laden
  useFocusEffect(
    useCallback(() => {
      if (!session?.user?.id) return;
      setAvatarBroken(false);
      setAvatarKey(Date.now());
      fetchProfile();
      fetchActiveJobCount();
    }, [session?.user?.id])
  );

  async function fetchProfile() {
    setLoadingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        avatar_url,
        company_name,
        company_slogan,
        company_description,
        industry,
        employee_count,
        address_street,
        address_zip,
        address_city,
        address_country,
        subscription_plan
      `)
      .eq('id', session.user.id)
      .single();

    if (!error) {
      setProfile(data || {});
    } else {
      console.warn('fetchProfile error', error);
    }
    setLoadingProfile(false);
  }

  async function fetchActiveJobCount() {
    if (!session?.user?.id) return;
    setLoadingJobs(true);
    const { count, error } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('employer_id', session.user.id)
      .eq('is_active', true);

    if (!error) setActiveJobCount(count ?? 0);
    setLoadingJobs(false);
  }

  // Avatar-Signed-URL
  useEffect(() => {
    (async () => {
      const raw = profile?.avatar_url;
      setSignedAvatarUrl(null);
      if (!raw) return;

      const parsed = extractBucketAndPath(raw);
      if (!parsed) {
        // externe URL
        setSignedAvatarUrl(raw);
        return;
      }

      try {
        const { bucket } = parsed;
        const decodedPath = decodeURIComponent(parsed.path);

        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(decodedPath, 60 * 60 * 24 * 7); // 7 Tage

        if (error) {
          console.warn('createSignedUrl error', error);
          setSignedAvatarUrl(raw);
          return;
        }
        setSignedAvatarUrl(data?.signedUrl || raw);
      } catch (e) {
        console.warn('signed url generation failed', e);
        setSignedAvatarUrl(raw);
      }
    })();
  }, [profile?.avatar_url]);

  // Fortschritt
  const completion = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      profile.company_name,
      profile.company_slogan,
      profile.company_description,
      profile.industry,
      profile.employee_count,
      profile.address_street,
      profile.address_zip,
      profile.address_city,
      profile.address_country,
      profile.avatar_url,
    ];
    const filled = fields.filter((v) =>
      v === 0 ? true : v !== null && v !== undefined && String(v).trim().length > 0
    ).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  const jobsSubtitle = useMemo(() => {
    if (loadingJobs || activeJobCount === null) return 'lädt …';
    return activeJobCount > 0
      ? `${activeJobCount} aktive ${activeJobCount === 1 ? 'Anzeige' : 'Anzeigen'}`
      : 'Inseriere jetzt deine erste Stellenanzeige';
  }, [loadingJobs, activeJobCount]);

  // Abo-Label
  const planLabel = (() => {
    const p = (profile?.subscription_plan || 'basic').toLowerCase();
    if (p === 'premium') return 'Premium';
    if (p === 'platin' || p === 'platinum') return 'Platin';
    return 'Basic';
  })();

  // --------- WICHTIG: Flex-Jobs (Page 1) öffnen ----------
  const handleOpenFlexJobs = () => {
    navigation.navigate('FlexJobs', {
      session,
      role: 'employer',
    });
  };

  if (loadingSession || loadingProfile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4db3f4" />
        <Text style={{ marginTop: 8, color: '#666' }}>Lade Profil…</Text>
      </View>
    );
  }

  // finale URL + Cache-Bust
  const rawAvatar = signedAvatarUrl || profile?.avatar_url;
  const avatarUri =
    !avatarBroken && rawAvatar
      ? `${rawAvatar}${rawAvatar.includes('?') ? '&' : '?'}v=${Date.now()}`
      : AVATAR_PLACEHOLDER;

  // SVG-Ring Parameter
  const SIZE = 96;
  const STROKE = 8;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const progress = Math.max(0, Math.min(100, completion));
  const dashOffset = CIRC * (1 - progress / 100);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ width: 24 }} />
          <Text style={styles.header}>Unternehmensprofil</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('EmployerSettingsScreen')}
            style={styles.iconButton}
            accessibilityLabel="Einstellungen öffnen"
          >
            <Ionicons name="settings-outline" size={24} color="#4db3f4" />
          </TouchableOpacity>
        </View>

        {/* PROFIL BLOCK */}
        <View style={styles.profileBlock}>
          {/* Fortschritts-Ring + Avatar */}
          <View style={{ width: SIZE, height: SIZE, marginBottom: 12 }}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke="#eef2f7"
                strokeWidth={STROKE}
                fill="none"
              />
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke="#4db3f4"
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${CIRC} ${CIRC}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                rotation="-90"
                origin={`${SIZE / 2}, ${SIZE / 2}`}
              />
            </Svg>

            <Image
              key={avatarKey}
              source={{ uri: avatarUri }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="none"
              onError={(e) => {
                console.warn('Avatar load error', e?.nativeEvent);
                setAvatarBroken(true);
                Alert.alert('Hinweis', 'Avatar konnte nicht geladen werden, zeige Platzhalter.');
              }}
            />
          </View>

          <Text style={styles.progressText}>{progress}% vollständig</Text>

          <Text style={styles.companyName}>
            {profile?.company_name || 'Unternehmen'}
          </Text>
          <Text style={styles.slogan}>
            {profile?.company_slogan || 'Slogan hinzufügen'}
          </Text>
          <Text style={styles.location}>
            📍 {profile?.address_city || '—'}, {profile?.address_country || '—'}
          </Text>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EmployerProfileEdit', { session })}
          >
            <Ionicons name="create-outline" size={18} color="#4db3f4" />
            <Text style={styles.editText}>Profil bearbeiten</Text>
          </TouchableOpacity>
        </View>

        {/* INFOKARTEN */}
        <View style={styles.cardContainer}>
          {/* Abonnement */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('SubscriptionScreen', { session })}
            accessibilityLabel="Abonnement öffnen"
          >
            <Ionicons name="star-outline" size={24} color="#4db3f4" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Abonnement</Text>
              <Text style={styles.cardSub}>{planLabel} aktiv</Text>
            </View>
          </TouchableOpacity>

          {/* Stellenanzeigen */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('EmployerJobs', { session })}
          >
            <Ionicons name="briefcase-outline" size={24} color="#4db3f4" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Stellenanzeigen</Text>
              <Text style={styles.cardSub}>{jobsSubtitle}</Text>
            </View>
          </TouchableOpacity>

          {/* Flex-Jobs → genau auf Page 1 */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={handleOpenFlexJobs}
            accessibilityLabel="Flex-Jobs öffnen"
          >
            <Ionicons name="flash-outline" size={24} color="#4db3f4" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.cardTitle}>Flex-Jobs</Text>
              <Text style={styles.cardSub}>Kurzfristige Aushilfen im Blick</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {completion < 100 && (
          <View style={styles.tipBox}>
            <Ionicons name="information-circle-outline" size={22} color="#4db3f4" />
            <Text style={styles.tipText}>
              Vervollständigen Sie Ihr Unternehmensprofil, um mehr qualifizierte Bewerber zu erreichen.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 76;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  scrollContent: { padding: 20, paddingBottom: 100 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 12,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4db3f4',
    textAlign: 'center',
    flex: 1,
  },
  iconButton: { padding: 6, borderRadius: 10 },

  profileBlock: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  avatar: {
    position: 'absolute',
    top: (96 - AVATAR_SIZE) / 2,
    left: (96 - AVATAR_SIZE) / 2,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#eef2f7',
  },
  progressText: { color: '#6b7280', fontSize: 12, marginBottom: 8 },

  companyName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  slogan: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 4 },
  location: { fontSize: 13, color: '#888', marginTop: 4 },

  editBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f2fb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editText: { color: '#4db3f4', marginLeft: 6, fontWeight: '600' },

  cardContainer: { marginTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#eef2f7',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  cardSub: { fontSize: 13, color: '#666', marginTop: 2 },

  tipBox: {
    marginTop: 8,
    backgroundColor: '#e6f2fb',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipText: { color: '#444', fontSize: 14, flex: 1, marginLeft: 12 },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
