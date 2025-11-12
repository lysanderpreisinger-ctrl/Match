// screens/EmployeeProfileViewScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
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
    return { bucket: urlOrPath.slice(0, firstSlash), path: urlOrPath.slice(firstSlash + 1) };
  }

  // Volle URL aus Supabase Storage
  const m = urlOrPath.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/i);
  if (m) return { bucket: m[1], path: m[2] };
  return null;
}

export default function EmployeeProfileViewScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Session
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Profil
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Avatar handling
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [signedAvatarUrl, setSignedAvatarUrl] = useState(null);

  // ---------------- Session laden ----------------
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn('getSession error', error);
      if (data?.session) setSession(data.session);
      setLoadingSession(false);
    })();
  }, []);

  // Erstes Laden
  useEffect(() => {
    if (!session?.user?.id) return;
    fetchProfile(true);
  }, [session?.user?.id]);

  // Wenn von außen ein refreshAt mitgegeben wurde, neu laden
  useEffect(() => {
    if (!session?.user?.id) return;
    if (route?.params?.refreshAt) {
      setAvatarKey(Date.now());
      setAvatarBroken(false);
      fetchProfile(true);
    }
  }, [route?.params?.refreshAt, session?.user?.id]);

  // Beim Zurückkehren neu laden
  useFocusEffect(
    useCallback(() => {
      if (!session?.user?.id) return;
      setAvatarBroken(false);
      setAvatarKey(Date.now());
      fetchProfile(true);
    }, [session?.user?.id])
  );

  // ---------------- Daten Laden ----------------
  async function fetchProfile(forceAvatarRefresh = false) {
    setLoadingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        avatar_url,
        first_name,
        last_name,
        bio,
        skills,
        qualification,
        german_level,
        english_level,
        experience,
        has_drivers_license,
        address_city,
        address_country,
        visibility,
        updated_at
      `)
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.warn('fetchProfile error', error);
      setProfile({});
    } else {
      setProfile(data || {});
      if (forceAvatarRefresh) {
        setAvatarKey(Date.now());
        setAvatarBroken(false);
      }
    }
    setLoadingProfile(false);
  }

  // IMMER eine signed URL generieren (funktioniert für public/private Buckets)
  useEffect(() => {
    (async () => {
      const raw = profile?.avatar_url;
      setSignedAvatarUrl(null);
      if (!raw) return;

      const parsed = extractBucketAndPath(raw);
      if (!parsed) {
        setSignedAvatarUrl(raw); // externe URL
        return;
      }

      try {
        const { bucket } = parsed;
        const decodedPath = decodeURIComponent(parsed.path);

        const { data, error } = await supabase
          .storage
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

  // ---------------- Completion ----------------
  const completion = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      profile.first_name,
      profile.last_name,
      profile.bio,
      (Array.isArray(profile.skills) && profile.skills.length > 0) ? 'ok' : '',
      profile.qualification,
      profile.german_level,
      profile.english_level,
      profile.experience,
      profile.address_city,
      profile.address_country,
      profile.avatar_url,
    ];
    const filled = fields.filter((v) =>
      v === 0 ? true : v !== null && v !== undefined && String(v).trim().length > 0
    ).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  const visible = Boolean(profile?.visibility ?? true);

  // finale URL + harter Cache-Bust über avatarKey
  const rawAvatar = signedAvatarUrl || profile?.avatar_url;
  const avatarUri =
    !avatarBroken && rawAvatar
      ? `${rawAvatar}${rawAvatar.includes('?') ? '&' : '?'}v=${avatarKey}`
      : AVATAR_PLACEHOLDER;

  // SVG-Ring Parameter
  const SIZE = 96;
  const STROKE = 8;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const progress = Math.max(0, Math.min(100, completion));
  const dashOffset = CIRC * (1 - progress / 100);

  if (loadingSession || loadingProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Zurück">
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.header}>Profil ansehen</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4db3f4" />
          <Text style={{ marginTop: 8, color: '#666' }}>Lade Profil…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Dein Name';
  const locationStr = `📍 ${profile?.address_city || '—'}, ${profile?.address_country || '—'}`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Zurück">
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.header}>Profil ansehen</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('EmployeeProfileEdit', { session, fromView: true })}
            style={styles.iconButton}
            accessibilityLabel="Profil bearbeiten"
          >
            <Ionicons name="create-outline" size={22} color="#4db3f4" />
          </TouchableOpacity>
        </View>

        {!visible && (
          <View style={styles.infoBanner}>
            <Ionicons name="eye-off-outline" size={18} color="#4db3f4" />
            <Text style={styles.infoBannerText}>
              Dein Profil ist aktuell <Text style={{ fontWeight: '700' }}>verborgen</Text>. Arbeitgeber können dich nicht finden.
            </Text>
          </View>
        )}

        {/* PROFIL BLOCK */}
        <View style={styles.profileBlock}>
          {/* Fortschritts-Ring + Avatar */}
          <View style={{ width: SIZE, height: SIZE, marginBottom: 12 }}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#eef2f7" strokeWidth={STROKE} fill="none" />
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
              onError={() => setAvatarBroken(true)}
            />
          </View>

          <Text style={styles.progressText}>{progress}% vollständig</Text>

          <Text style={styles.name}>{name}</Text>
          {/* Keine Headline mehr */}
          <Text style={styles.location}>{locationStr}</Text>
        </View>

        {/* Angaben */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Über mich</Text>
          <Text style={styles.bodyText}>{profile?.bio || 'Noch keine Beschreibung hinterlegt.'}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Skills</Text>
          {Array.isArray(profile?.skills) && profile.skills.length > 0 ? (
            <View style={styles.chipsWrap}>
              {profile.skills.map((s, idx) => (
                <View key={`${s}-${idx}`} style={styles.chip}>
                  <Text style={styles.chipText}>{s}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>Noch keine Skills hinterlegt.</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Qualifikation & Sprachen</Text>
          <Row icon="school-outline" label="Schul-/Abschluss" value={profile?.qualification || '—'} />
          <Row icon="chatbubbles-outline" label="Deutsch" value={profile?.german_level || '—'} />
          <Row icon="chatbubbles-outline" label="Englisch" value={profile?.english_level || '—'} />
          <Row
            icon="briefcase-outline"
            label="Berufserfahrung"
            value={typeof profile?.experience === 'number' ? `${profile.experience} Jahre` : (profile?.experience || '—')}
          />
          <Row icon="car-outline" label="Führerschein" value={profile?.has_drivers_license ? 'Ja' : 'Nein'} last />
        </View>

        {progress < 100 && (
          <View style={styles.tipBox}>
            <Ionicons name="information-circle-outline" size={22} color="#4db3f4" />
            <Text style={styles.tipText}>
              Vervollständige dein Profil (Skills, Erfahrung, Foto), um mehr passende Job-Angebote zu erhalten.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={18} color="#4db3f4" />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
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
  header: { fontSize: 22, fontWeight: 'bold', color: '#4db3f4', textAlign: 'center', flex: 1 },
  iconButton: { padding: 6, borderRadius: 10 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#e6f2fb',
    borderWidth: 1,
    borderColor: '#d7eafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  infoBannerText: { flex: 1, color: '#374151', fontSize: 13 },

  profileBlock: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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

  name: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  location: { fontSize: 13, color: '#888', marginTop: 4 },

  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  bodyText: { color: '#374151', lineHeight: 20 },
  muted: { color: '#6b7280' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#e6f2fb',
    borderColor: '#d7eafc',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: '#1f2937', fontWeight: '600', fontSize: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: '#eef2f7',
    borderBottomWidth: 1,
  },
  rowIconWrap: { width: 28, alignItems: 'center', marginRight: 8 },
  rowLabel: { flex: 1, color: '#374151', fontWeight: '600' },
  rowValue: { color: '#111827' },

  tipBox: {
    marginTop: 4,
    backgroundColor: '#e6f2fb',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipText: { color: '#444', fontSize: 14, flex: 1, marginLeft: 12 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
