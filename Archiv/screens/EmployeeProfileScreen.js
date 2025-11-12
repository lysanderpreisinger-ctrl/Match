import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { Image } from 'expo-image';
import { supabase } from '../supabaseClient';
import { useLang } from '../LanguageContext';

const AVATAR_PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

// Bucket & Pfad aus Supabase-Storage-URL ziehen
function extractBucketAndPath(urlOrPath) {
  if (!urlOrPath) return null;

  if (!/^https?:\/\//i.test(urlOrPath)) {
    // reiner Pfad
    const firstSlash = urlOrPath.indexOf('/');
    if (firstSlash === -1) return null;
    return {
      bucket: urlOrPath.slice(0, firstSlash),
      path: urlOrPath.slice(firstSlash + 1),
    };
  }

  const m = urlOrPath.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/i);
  if (m) return { bucket: m[1], path: m[2] };
  return null;
}

// kleinen Teaser aus dem Über-mich-Text bauen
function bioPreview(bio, max = 90) {
  if (!bio || !String(bio).trim())
    return 'Erzähle kurz etwas über dich – Beruf, Stärken, was du suchst.';
  const clean = String(bio).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export default function EmployeeProfileScreen() {
  const navigation = useNavigation();
  const { t } = useLang();

  // Session
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Profil
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Stats
  const [matchCount, setMatchCount] = useState(null);
  const [likesReceived, setLikesReceived] = useState(null);
  const [likesGiven, setLikesGiven] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Avatar handling
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [signedAvatarUrl, setSignedAvatarUrl] = useState(null);

  // Sichtbarkeit (nur 2!)
  const [visibleJobs, setVisibleJobs] = useState(true);
  const [visibleFlex, setVisibleFlex] = useState(true);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  // kleines Info-Popup für FlexJobs
  const [showFlexInfo, setShowFlexInfo] = useState(false);

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
    fetchProfile();
    fetchStats();
  }, [session?.user?.id]);

  // Bei Fokus refresh
  useFocusEffect(
    useCallback(() => {
      if (!session?.user?.id) return;
      setAvatarBroken(false);
      setAvatarKey(Date.now());
      fetchProfile(true);
      fetchStats();
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
        visibility_jobs,
        visibility_flexjobs
      `)
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.warn('fetchProfile error', error);
      setProfile({});
    } else {
      setProfile(data || {});
      setVisibleJobs(
        typeof data?.visibility_jobs === 'boolean' ? data.visibility_jobs : true
      );
      setVisibleFlex(
        typeof data?.visibility_flexjobs === 'boolean'
          ? data.visibility_flexjobs
          : true
      );

      if (forceAvatarRefresh) {
        setAvatarKey(Date.now());
        setAvatarBroken(false);
      }
    }
    setLoadingProfile(false);
  }

  async function fetchStats() {
    if (!session?.user?.id) return;
    setLoadingStats(true);

    const { count: mCount } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', session.user.id);

    const { count: lrCount } = await supabase
      .from('swipes')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'like')
      .eq('target_type', 'profile')
      .eq('target_id', session.user.id);

    const { count: lgCount } = await supabase
      .from('swipes')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'like')
      .eq('target_type', 'job')
      .eq('swiper_id', session.user.id);

    setMatchCount(mCount ?? 0);
    setLikesReceived(lrCount ?? 0);
    setLikesGiven(lgCount ?? 0);
    setLoadingStats(false);
  }

  // signierte Avatar-URL bauen
  useEffect(() => {
    (async () => {
      const raw = profile?.avatar_url;
      setSignedAvatarUrl(null);
      if (!raw) return;

      const parsed = extractBucketAndPath(raw);
      if (!parsed) {
        setSignedAvatarUrl(raw);
        return;
      }

      try {
        const { bucket } = parsed;
        const decodedPath = decodeURIComponent(parsed.path);

        const { data, error } = await supabase
          .storage
          .from(bucket)
          .createSignedUrl(decodedPath, 60 * 60 * 24 * 7);

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
      Array.isArray(profile.skills) && profile.skills.length > 0 ? 'ok' : '',
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

  const statsSubtitle = useMemo(() => {
    if (loadingStats) return t('employeeProfile.statsLoading') || 'lädt …';
    return `${matchCount ?? 0} ${t('employeeProfile.matches') || 'Matches'} · ${
      likesReceived ?? 0
    } ${t('employeeProfile.likesReceived') || 'Likes erhalten'} · ${
      likesGiven ?? 0
    } ${t('employeeProfile.likesGiven') || 'eigene Likes'}`;
  }, [loadingStats, matchCount, likesReceived, likesGiven, t]);

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

  // ---------------- Actions ----------------
  const updateVisibilityFields = async (payload) => {
    if (!session?.user?.id) return false;
    setUpdatingVisibility(true);
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', session.user.id);
    setUpdatingVisibility(false);
    if (error) {
      Alert.alert(
        t('employeeProfile.visibilityErrorTitle') || 'Fehler',
        t('employeeProfile.visibilityErrorText') ||
          'Sichtbarkeit konnte nicht gespeichert werden.'
      );
      return false;
    }
    return true;
  };

  const toggleVisibilityJobs = async (next) => {
    const ok = await updateVisibilityFields({ visibility_jobs: next });
    if (ok) setVisibleJobs(next);
  };

  const toggleVisibilityFlex = async (next) => {
    const ok = await updateVisibilityFields({ visibility_flexjobs: next });
    if (ok) setVisibleFlex(next);
  };

  if (loadingSession || loadingProfile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4db3f4" />
        <Text style={{ marginTop: 8, color: '#666' }}>
          {t('employeeProfile.loading') || 'Lade Profil…'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ width: 24 }} />
          <Text style={styles.header}>
            {t('employeeProfile.title') || 'Dein Profil'}
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('EmployerSettingsScreen', {
                session,
                role: 'employee',
              })
            }
            style={styles.iconButton}
            accessibilityLabel={t('employeeProfile.openSettings') || 'Einstellungen öffnen'}
          >
            <Ionicons name="settings-outline" size={24} color="#4db3f4" />
          </TouchableOpacity>
        </View>

        {/* PROFIL BLOCK */}
        <View style={styles.profileBlock}>
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
                Alert.alert(
                  t('employeeProfile.avatarErrorTitle') || 'Hinweis',
                  t('employeeProfile.avatarErrorText') ||
                    'Avatar konnte nicht geladen werden, zeige Platzhalter.'
                );
              }}
            />
          </View>

          <Text style={styles.progressText}>
            {progress}% {t('employeeProfile.complete') || 'vollständig'}
          </Text>

          <Text style={styles.name}>
            {`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() ||
              t('employeeProfile.yourName') ||
              'Dein Name'}
          </Text>

          <Text style={styles.bioTeaser}>{bioPreview(profile?.bio)}</Text>

          <Text style={styles.location}>
            📍 {profile?.address_city || '—'}, {profile?.address_country || '—'}
          </Text>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() =>
              navigation.navigate('EmployeeProfileEdit', {
                session,
                onSavedPing: Date.now(),
              })
            }
          >
            <Ionicons name="create-outline" size={18} color="#4db3f4" />
            <Text style={styles.editText}>
              {t('employeeProfile.edit') || 'Profil bearbeiten'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* INFO-KARTEN */}
        <View style={styles.cardContainer}>
          {/* Sichtbar bei Stellenanzeigen */}
          <View style={styles.card}>
            <Ionicons name="briefcase-outline" size={24} color="#4db3f4" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.cardTitle}>
                {t('employeeProfile.visibilityJobs') || 'Bei Stellenanzeigen zeigen'}
              </Text>
              <Text style={styles.cardSub}>
                {visibleJobs
                  ? t('employeeProfile.visibilityJobsOn') ||
                    'Dein Profil erscheint Arbeitgebern bei regulären Jobs.'
                  : t('employeeProfile.visibilityJobsOff') ||
                    'Du wirst bei regulären Jobs nicht angezeigt.'}
              </Text>
            </View>
            <Switch
              value={visibleJobs}
              disabled={updatingVisibility}
              onValueChange={toggleVisibilityJobs}
            />
          </View>

          {/* Sichtbar bei FlexJobs */}
          <View style={styles.card}>
            <Ionicons name="flash-outline" size={24} color="#4db3f4" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.cardTitle}>
                  {t('employeeProfile.visibilityFlex') || 'Bei FlexJobs zeigen'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowFlexInfo(true)}
                  style={{ marginLeft: 4, padding: 4 }}
                >
                  <Ionicons name="information-circle-outline" size={16} color="#4db3f4" />
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSub}>
                {visibleFlex
                  ? t('employeeProfile.visibilityFlexOn') ||
                    'Du kannst für spontane Einsätze gefunden werden.'
                  : t('employeeProfile.visibilityFlexOff') ||
                    'Du wirst bei FlexJobs nicht angezeigt.'}
              </Text>
            </View>
            <Switch
              value={visibleFlex}
              disabled={updatingVisibility}
              onValueChange={toggleVisibilityFlex}
            />
          </View>

          {/* Profil ansehen */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('EmployeeProfileViewScreen', {
                session,
                refreshAt: Date.now(),
              })
            }
          >
            <Ionicons name="person-circle-outline" size={24} color="#4db3f4" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.cardTitle}>
                {t('employeeProfile.viewProfile') || 'Profil ansehen'}
              </Text>
              <Text style={styles.cardSub}>
                {t('employeeProfile.viewProfileSub') || 'So sehen Arbeitgeber dein Profil'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Lebenslauf / Dokumente */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ResumeDocumentsScreen', { session })}
          >
            <Ionicons name="document-text-outline" size={24} color="#4db3f4" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.cardTitle}>
                {t('employeeProfile.docs') || 'Lebenslauf & Dokumente'}
              </Text>
              <Text style={styles.cardSub}>
                {t('employeeProfile.docsSub') || 'PDF hochladen, aktualisieren oder teilen'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Tippbox */}
        {completion < 100 && (
          <View style={styles.tipBox}>
            <Ionicons name="information-circle-outline" size={22} color="#4db3f4" />
            <Text style={styles.tipText}>
              {t('employeeProfile.tip') ||
                'Vervollständige dein Profil (Skills, Erfahrung, Foto), um mehr passende Job-Angebote zu erhalten.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* kleines Info-Popup für FlexJobs */}
      <Modal
        transparent
        visible={showFlexInfo}
        animationType="fade"
        onRequestClose={() => setShowFlexInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {t('employeeProfile.flexInfoTitle') || 'Was sind FlexJobs?'}
            </Text>
            <Text style={styles.modalText}>
              {t('employeeProfile.flexInfoText') ||
                'FlexJobs sind kurzfristige oder stundenweise Jobs (z. B. Event, Gastro, Logistik). Wenn du hier sichtbar bist, können Arbeitgeber dich dafür direkt anfragen.'}
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setShowFlexInfo(false)}
            >
              <Text style={styles.modalBtnText}>
                {t('common.ok') || 'OK'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  header: { fontSize: 22, fontWeight: 'bold', color: '#4db3f4', textAlign: 'center', flex: 1 },
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

  name: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  bioTeaser: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 4 },
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

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  // modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    width: '100%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  modalText: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 10 },
  modalBtn: {
    backgroundColor: '#4db3f4',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '600' },
});
