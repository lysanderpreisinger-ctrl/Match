// screens/EmployeeProfileViewScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, Modal
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { supabase } from '../supabaseClient';

const PRIMARY = '#4db3f4';
const AVATAR_PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

export default function EmployeeProfileViewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const profileId = route?.params?.profileId;
  const onDone = route?.params?.onDone;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Match-Modal
  const [showCongrats, setShowCongrats] = useState(false);
  const [matchId, setMatchId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) setSession(data.session);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select(`
        id, avatar_url, first_name, last_name, bio, skills,
        qualification, german_level, english_level, experience,
        address_city, address_country, has_drivers_license
      `)
      .eq('id', profileId)
      .single();
    setProfile(data || {});
    setLoading(false);
  }, [profileId]);

  const loadSavedState = useCallback(async () => {
    if (!session?.user?.id || !profileId) return;
    const { data } = await supabase
      .from('saved_profiles')
      .select('id')
      .eq('saver_id', session.user.id)
      .eq('saved_profile_id', profileId)
      .maybeSingle();
    setSaved(!!data);
  }, [session?.user?.id, profileId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSavedState(); }, [loadSavedState]);

  // --------- Platzhalter-Logik (nur Anzeige, kein Design ändern) ---------
  const displayName = useMemo(
    () => `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Profil',
    [profile]
  );

  const avatarUri = profile?.avatar_url || AVATAR_PLACEHOLDER;

  const locationText = useMemo(() => {
    const city = (profile?.address_city || '').trim();
    const country = (profile?.address_country || '').trim();
    if (!city && !country) return '📍 Ort unbekannt';
    if (city && country) return `📍 ${city}, ${country}`;
    return `📍 ${city || country}`;
  }, [profile?.address_city, profile?.address_country]);

  const aboutText = useMemo(() => {
    const t = (profile?.bio || '').trim();
    return t.length ? t : 'Noch keine Beschreibung hinterlegt.';
  }, [profile?.bio]);

  const skillsArray = useMemo(() => {
    return Array.isArray(profile?.skills) && profile.skills.length > 0
      ? profile.skills
      : ['Noch keine Skills eingetragen'];
  }, [profile?.skills]);

  const qualificationText = (profile?.qualification && String(profile.qualification).trim().length)
    ? profile.qualification
    : '—';

  const experienceText = (profile?.experience || profile?.experience === 0)
    ? `${profile.experience} Jahre Erfahrung`
    : '—';

  const germanLevelText = (profile?.german_level && String(profile.german_level).trim().length)
    ? `Deutsch: ${profile.german_level}`
    : 'Deutsch: —';

  const englishLevelText = (profile?.english_level && String(profile.english_level).trim().length)
    ? `Englisch: ${profile.english_level}`
    : 'Englisch: —';

  const driverLicenseText = (typeof profile?.has_drivers_license === 'boolean')
    ? (profile.has_drivers_license ? '🚗 Führerschein vorhanden' : '🚗 Kein Führerschein')
    : '🚗 Angabe fehlt';

  // -----------------------------------------------------------------------

  const saveToggle = async () => {
    if (!session?.user?.id || !profile?.id) return;
    setSaving(true);
    if (saved) {
      await supabase
        .from('saved_profiles')
        .delete()
        .eq('saver_id', session.user.id)
        .eq('saved_profile_id', profile.id);
      setSaved(false);
    } else {
      await supabase
        .from('saved_profiles')
        .insert({ saver_id: session.user.id, saved_profile_id: profile.id });
      setSaved(true);
    }
    setSaving(false);
  };

  // --- Like/Skip: mit Match-Erkennung & Payment-Redirect (NICHT angefasst) ---
  const likeAndBack = async () => {
    if (!session?.user?.id || !profile?.id) return;

    await supabase.from('swipes').insert({
      swiper_id: session.user.id,
      target_id: profile.id,
      target_type: 'profile',
      direction: 'like',
    });

    const { data: jobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('employer_id', session.user.id);
    const jobIds = (jobs || []).map(j => j.id);

    let matchedNow = false;
    if (jobIds.length) {
      const { data: jobLikeRow } = await supabase
        .from('swipes')
        .select('id')
        .eq('swiper_id', profile.id)
        .eq('direction', 'like')
        .eq('target_type', 'job')
        .in('target_id', jobIds)
        .maybeSingle();

      if (jobLikeRow) {
        const { data: m } = await supabase
          .from('matches')
          .insert({
            employer_id: session.user.id,
            employee_id: profile.id,
            initiator: profile.id,
            status: 'confirmed',
            employer_unlocked: false,
            employer_payment_status: 'pending',
          })
          .select('id')
          .single();

        if (m?.id) {
          setMatchId(m.id);
          matchedNow = true;
          setShowCongrats(true);
        }
      }
    }

    if (!matchedNow) {
      onDone?.();
      navigation.goBack();
    }
  };

  const skipAndBack = async () => {
    if (!session?.user?.id || !profile?.id) return;
    await supabase.from('swipes').insert({
      swiper_id: session.user.id,
      target_id: profile.id,
      target_type: 'profile',
      direction: 'skip',
    });
    onDone?.();
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{displayName}</Text>
        <TouchableOpacity onPress={saveToggle} disabled={saving}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={24} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
        <Text style={styles.name}>{displayName}</Text>
        {/* Standort immer anzeigen, mit Platzhalter */}
        <Text style={styles.location}>{locationText}</Text>

        {/* Über mich – immer anzeigen, mit Platzhaltertext */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Über mich</Text>
          <Text style={styles.cardText}>{aboutText}</Text>
        </View>

        {/* Skills – immer anzeigen; wenn leer, ein Placeholder-Chip */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Skills</Text>
          <View style={styles.chipWrap}>
            {skillsArray.map((s) => (
              <View key={s} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>
            ))}
          </View>
        </View>

        {/* Fakten – immer anzeigen, fehlende Werte mit „—“ bzw. Angabe fehlt */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fakten</Text>
          <Text style={styles.cardLine}>🎓 {qualificationText}</Text>
          <Text style={styles.cardLine}>💼 {experienceText}</Text>
          <Text style={styles.cardLine}>🇩🇪 {germanLevelText}</Text>
          <Text style={styles.cardLine}>🇬🇧 {englishLevelText}</Text>
          <Text style={styles.cardLine}>{driverLicenseText}</Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.skipBtn]} onPress={skipAndBack}>
            <Ionicons name="close" size={18} color="#111827" />
            <Text style={[styles.actionText, { color: '#111827' }]}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={likeAndBack}>
            <Ionicons name="heart" size={18} color="#fff" />
            <Text style={[styles.actionText, { color: '#fff' }]}>Like</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 🎉 Match-Popup (unverändert) */}
      <Modal visible={showCongrats} transparent animationType="fade" onRequestClose={() => setShowCongrats(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎉 Glückwunsch! Ihr habt ein Match!</Text>
            <View style={{ height: 10 }} />
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#e5e7eb' }]}
                onPress={() => {
                  setShowCongrats(false);
                  onDone?.();
                  navigation.goBack();
                }}
              >
                <Text style={[styles.modalBtnText, { color: '#111827' }]}>Weiter swipen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: PRIMARY }]}
                onPress={() => {
                  setShowCongrats(false);
                  navigation.navigate('ChatDetailScreen', { matchId });
                }}
              >
                <Text style={styles.modalBtnText}>Zum Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const AVATAR = 120;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f8fb' },
  header: {
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignSelf: 'center', backgroundColor: '#eef2f7' },
  name: { marginTop: 10, fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  location: { marginTop: 4, textAlign: 'center', color: '#64748b' },

  card: { marginTop: 14, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  cardText: { color: '#334155', lineHeight: 20 },
  cardLine: { color: '#334155' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#e6f2fb', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { color: '#075985', fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  skipBtn: { backgroundColor: '#e5e7eb' },
  likeBtn: { backgroundColor: PRIMARY },
  actionText: { fontWeight: '700' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e5e7eb' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontWeight: '800', color: '#fff' },
});
