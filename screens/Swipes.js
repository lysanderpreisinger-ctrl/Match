// screens/Swipes.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Alert,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Modal,
} from 'react-native';
import Swiper from 'react-native-deck-swiper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import { calculateMatchScore, handleEmployerSecondSwipe } from '../utils/matching';

const { width } = Dimensions.get('window');
const PRIMARY = '#4db3f4';

const TRANSLATIONS = {
  de: {
    no_results: 'Keine passenden Ergebnisse gefunden',
    no_cards_anymore: 'Keine Karten mehr',
    not_logged_in: 'Nicht angemeldet',
    please_login: 'Bitte melde dich an, bevor du swipest.',
    swipe_hint_title: 'Nach links = Skip · Nach rechts = Like',
    saved: 'Gespeichert',
    saved_profiles: 'Gespeicherte Profile',
  },
  en: {
    no_results: 'No matching results found',
    no_cards_anymore: 'No more cards',
    not_logged_in: 'Not logged in',
    please_login: 'Please log in before swiping.',
    swipe_hint_title: 'Swipe left = Skip · right = Like',
    saved: 'Saved',
    saved_profiles: 'Saved profiles',
  },
};
function translate(key, lang = 'de') {
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || key;
}

// Helpers
function toRad(v) { return (v * Math.PI) / 180; }
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(1 - a), Math.sqrt(a));
}

// ★ robust: Alter aus verschiedenen Feldern berechnen
function getAgeFromCard(card) {
  const raw =
    card?.birthdate ||
    card?.date_of_birth ||
    card?.dob ||
    card?.birthday ||
    null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

// ★ Standort-String bauen (Profil/Job)
function getLocationText(card, isEmployeeCard) {
  if (isEmployeeCard) {
    const city = card?.address_city || card?.city || '';
    const country = card?.address_country || card?.country || '';
    const loc = [city, country].filter(Boolean).join(', ');
    return loc || 'Ort unbekannt';
  }
  const city = card?.city || card?.address_city || '';
  const loc = [city].filter(Boolean).join(', ');
  return loc || 'Ort unbekannt';
}

// ★ Beschreibung/Teaser holen
function getDescription(card, isEmployeeCard) {
  const text = isEmployeeCard ? (card?.bio || card?.about) : (card?.description || card?.desc);
  return (typeof text === 'string' && text.trim().length > 0)
    ? text.trim()
    : (isEmployeeCard ? 'Noch keine Beschreibung hinterlegt.' : 'Keine Jobbeschreibung vorhanden.');
}

export default function Swipes({ route }) {
  const paramsSession = route?.params?.session ?? null;
  const paramsRole    = route?.params?.role ?? null;
  const paramsFilters = route?.params?.filters ?? null;
  const showOnboardingHint = true;

  const navigation = useNavigation();
  const swiperRef = useRef(null);

  const [session, setSession] = useState(paramsSession);
  const [effectiveRole, setEffectiveRole] = useState(paramsRole ?? 'employee');
  const [filters, setFilters] = useState(paramsFilters);

  const [cards, setCards] = useState(null);
  const [loadingRole, setLoadingRole] = useState(!paramsRole || !paramsSession);

  // Centered Onboarding Overlay
  const [showHint, setShowHint] = useState(false);
  const hintAnim = useRef(new Animated.Value(0)).current;

  // unten: swipe-hinweis (dezent)
  const bottomHintAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showOnboardingHint) {
      setShowHint(true);
      Animated.timing(hintAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [showOnboardingHint, hintAnim]);

  useEffect(() => {
    Animated.timing(bottomHintAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(bottomHintAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }, 2200);
    });
  }, [bottomHintAnim]);

  const closeHint = () => {
    Animated.timing(hintAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setShowHint(false));
  };

  // Session/Rolle sichern
  useEffect(() => {
    (async () => {
      try {
        let currentSession = paramsSession;
        if (!currentSession) {
          const { data, error } = await supabase.auth.getSession();
          if (error) console.warn('getSession error:', error);
          currentSession = data?.session ?? null;
          if (currentSession) setSession(currentSession);
        }

        if (!paramsRole && currentSession?.user?.id) {
          const { data: prof, error: pErr } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentSession.user.id)
            .maybeSingle();
          if (pErr) console.warn('profiles role fetch error:', pErr);
          const roleFromDb = prof?.role || 'employer';
          setEffectiveRole(roleFromDb);
        } else if (paramsRole) {
          setEffectiveRole(paramsRole);
        }
      } finally {
        setLoadingRole(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (route?.params?.filters !== undefined) {
      setFilters(route.params.filters);
    }
  }, [route?.params?.filters]);

  useEffect(() => {
    if (loadingRole) return;
    (async () => {
      try {
        setCards(null);
        if (filters) {
          await fetchFiltered(filters);
        } else {
          await fetchDefault();
        }
      } catch (e) {
        console.error('load cards error:', e);
        setCards([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRole, JSON.stringify(filters), effectiveRole, session?.user?.id]);

  // --------- MIT FILTER ----------
  async function fetchFiltered(flt) {
    if (effectiveRole === 'employee') {
      const {
        employmentForm,
        employmentType,
        hasChristmasBonus,
        hasHolidayBonus,
        location,
        radius,
      } = flt || {};

      let query = supabase.from('jobs').select('*');

      if (session?.user?.id) {
        query = query.neq('employer_id', session.user.id);
      }

      if (employmentForm)    query = query.eq('employment_form', employmentForm);
      if (employmentType)    query = query.eq('employment_type', employmentType);
      if (hasChristmasBonus) query = query.eq('christmas_bonus', true);
      if (hasHolidayBonus)   query = query.eq('holiday_bonus', true);

      const { data, error } = await query;
      if (error) { console.error('Jobs-Filter-Error:', error); setCards([]); return; }
      const base = Array.isArray(data) ? data : [];

      let filtered = base;
      if (location && radius) {
        filtered = base.filter((job) => {
          if (!(job?.latitude && job?.longitude)) return false;
          job.distance_km = getDistanceKm(
            location.latitude, location.longitude, job.latitude, job.longitude
          );
          return job.distance_km <= radius;
        });
      }

      const scored = filtered
        .map((job) => ({
          ...job,
          score: calculateMatchScore(session?.user ?? {}, job, flt || {}),
        }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      setCards(scored);
    } else {
      const {
        employment_type,
        industry,
        availability,
        min_experience_years,
        german_level_1_10,
      } = flt || {};

      let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee')
        .eq('visibility_jobs', true);

      if (employment_type) query = query.contains('employment_type', [employment_type]);
      if (industry)        query = query.eq('industry', industry);
      if (availability)    query = query.eq('availability', availability);
      if (typeof min_experience_years === 'number' && min_experience_years > 0) {
        query = query.gte('experience_years', min_experience_years);
      }
      if (typeof german_level_1_10 === 'number' && german_level_1_10 > 1) {
        query = query.gte('german_level_1_10', german_level_1_10);
      }

      const { data, error } = await query;
      if (error) { console.error('Profiles-Filter-Error:', error); setCards([]); return; }

      let base = Array.isArray(data) ? data : [];

      if (base.length === 0) {
        const { data: allEmployees, error: allErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'employee')
          .eq('visibility_jobs', true);
        if (allErr) { console.error('Profiles-Fallback-Error:', allErr); setCards([]); return; }
        base = allEmployees || [];
      }

      const scored = base
        .map((p) => ({
          ...p,
          score: calculateMatchScore(session?.user ?? {}, p, flt || {}),
        }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      setCards(scored);
    }
  }

  // --------- OHNE FILTER ----------
  async function fetchDefault() {
    if (effectiveRole === 'employee') {
      let query = supabase.from('jobs').select('*');
      if (session?.user?.id) query = query.neq('employer_id', session.user.id);
      const { data, error } = await query;
      if (error) { console.error('Jobs-Default-Error:', error); setCards([]); return; }
      setCards(Array.isArray(data) ? data : []);
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee')
        .eq('visibility_jobs', true);
      if (error) { console.error('Profiles-Default-Error:', error); setCards([]); return; }
      setCards(Array.isArray(data) ? data : []);
    }
  }

  // ---------- Swipe-Handler ----------
  const onSwipedLeft  = async (idx) => { await recordSwipe(idx, 'Skip'); };
  const onSwipedRight = async (idx) => { await recordSwipe(idx, 'Like'); };

  const recordSwipe = async (idx, direction) => {
    const card = cards?.[idx];
    if (!card) return null;

    const swiperId = session?.user?.id;
    if (!swiperId) {
      Alert.alert(translate('not_logged_in'), translate('please_login'));
      return null;
    }

    const dir = String(direction || '').toLowerCase();
    const targetType = effectiveRole === 'employer' ? 'profile' : 'job';

    const { error: swipeErr } = await supabase.from('swipes').insert({
      swiper_id: swiperId,
      target_id: card.id,
      target_type: targetType,
      direction: dir,
    });
    if (swipeErr) { console.error('Swipe-Error:', swipeErr); return null; }

    if (!(effectiveRole === 'employer' && dir === 'like')) return null;

    const { data: jobsOfEmployer, error: jobsErr } = await supabase
      .from('jobs')
      .select('id')
      .eq('employer_id', swiperId);
    if (jobsErr) { console.error('Jobs-of-employer-Error:', jobsErr); return null; }

    const jobIds = (jobsOfEmployer || []).map((j) => j.id);
    if (jobIds.length === 0) return null;

    const { data: jobLikeRow, error: likeErr } = await supabase
      .from('swipes')
      .select('id')
      .eq('swiper_id', card.id)
      .eq('direction', 'like')
      .eq('target_type', 'job')
      .in('target_id', jobIds)
      .maybeSingle();

    if (likeErr || !jobLikeRow) return null;

    const { data: matchInsert, error: mErr } = await supabase
      .from('matches')
      .insert({
        employer_id: swiperId,
        employee_id: card.id,
        initiator: card.id,
        status: 'confirmed',
        employer_unlocked: false,
        employer_payment_status: 'pending',
      })
      .select('id')
      .single();

    if (mErr) { console.error('Match-Insert-Error:', mErr); return null; }

    await handleEmployerSecondSwipe({
      employerId: swiperId,
      matchId: matchInsert?.id,
      navigation,
    });

    return matchInsert?.id ?? null;
  };

  // ---------- Karte klickbar ----------
  const handleCardPress = (card) => {
    if (!card) return;
    if (effectiveRole === 'employer') {
      navigation.navigate('EmployeeProfileViewScreen', {
        profileId: card.id,
        from: 'Swipes',
        onDone: () => swiperRef.current?.swipeRight(), // Like = rechts
      });
    } else {
      navigation.navigate('JobDetailScreen', {
        jobId: card.id,
        from: 'Swipes',
      });
    }
  };

  // ---------- Karte rendern ----------
  const renderCard = (card) => {
    if (!card) return null;

    const isEmployeeCard = effectiveRole === 'employer';
    const age = isEmployeeCard ? getAgeFromCard(card) : null;

    const hasImage = isEmployeeCard ? !!card?.avatar_url : !!card?.company_logo_url;
    const imageUri = isEmployeeCard ? card?.avatar_url : card?.company_logo_url;

    const leftText = isEmployeeCard
      ? (card?.education || card?.qualification || '—')
      : (card?.company_name || card?.industry || '—');

    const midText = card?.employment_type
      ? (Array.isArray(card.employment_type) ? card.employment_type[0] : String(card.employment_type))
      : '—';

    const rightText = getLocationText(card, isEmployeeCard);
    const description = getDescription(card, isEmployeeCard);

    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => handleCardPress(card)}>
        <View style={styles.card}>
          {hasImage ? (
            <Image source={{ uri: imageUri }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Text style={styles.placeholderText}>
                {isEmployeeCard ? 'Kein Bild' : 'Kein Logo'}
              </Text>
            </View>
          )}

          <Text style={styles.title}>
            {isEmployeeCard
              ? `${`${card?.first_name ?? ''} ${card?.last_name ?? ''}`.trim() || 'Profil'}${age ? ` · ${age}` : ''}`
              : (card?.title || 'Stellenanzeige')}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.tag}>{leftText}</Text>
            <Text style={styles.tag}>{midText}</Text>
            <Text style={styles.tag}>{rightText}</Text>
          </View>

          <View style={styles.descBox}>
            <Text style={styles.descText} numberOfLines={4}>
              {description}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ---------- Screen ----------
  if (loadingRole) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('SavedProfilesScreen')}
            accessibilityLabel={translate('saved_profiles')}
          >
            <Ionicons name="bookmark-outline" size={24} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>jatch</Text>
          <Ionicons name="options-outline" size={24} color={PRIMARY} />
        </View>

        <View style={styles.loading}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('SavedProfilesScreen')}
          accessibilityLabel={translate('saved_profiles')}
        >
          <Ionicons name="bookmark-outline" size={24} color={PRIMARY} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>jatch</Text>

        <TouchableOpacity
          onPress={() => {
            navigation.navigate(
              effectiveRole === 'employee' ? 'FilterScreenEmployee' : 'FilterScreenEmployer',
              {
                session,
                role: effectiveRole,
                onApply: (f) => setFilters(f),
              }
            );
          }}
          accessibilityLabel="Filter öffnen"
        >
          <Ionicons name="options-outline" size={24} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* Centered Onboarding Overlay */}
      <Modal visible={showHint} transparent animationType="fade" onRequestClose={closeHint}>
        <View style={styles.centerOverlay}>
          <Animated.View
            style={[
              styles.hintCard,
              {
                opacity: hintAnim,
                transform: [{
                  scale: hintAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }),
                }],
              },
            ]}
          >
            {/* Links X, rechts Herz – korrekt */}
            <View style={styles.hintIconRow}>
              <Ionicons name="close-outline" size={22} color="#fff" />
              <Text style={styles.hintDivider}>·</Text>
              <Ionicons name="heart-outline" size={22} color="#fff" />
            </View>
            <Text style={styles.hintTitle}>
              {translate('swipe_hint_title')}
            </Text>
            <Text style={styles.hintSub}>Tippe zum Schließen</Text>
            <TouchableOpacity style={styles.hintCloseBtn} onPress={closeHint}>
              <Text style={styles.hintCloseText}>OK</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Swiper */}
      <View style={styles.swiperWrapper}>
        {cards === null ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : cards.length === 0 ? (
          <View style={styles.loading}>
            <Text style={styles.empty}>{translate('no_results')}</Text>
          </View>
        ) : (
          <Swiper
            ref={swiperRef}
            cards={cards}
            renderCard={renderCard}
            onSwipedLeft={onSwipedLeft}   // LINKS = Skip
            onSwipedRight={onSwipedRight} // RECHTS = Like
            onSwipedAll={() => Alert.alert(translate('no_cards_anymore'))}
            // ==== OVERLAY-FIXES ====
            overlayLabels={{
              // Skip-Label (Swipe nach links): oben rechts am Kartenrand, gleiches Design wie Like
              left:  {
                title: 'Skip',
                style: {
                  label: {
                    borderColor: '#1f2937',
                    color: '#1f2937',
                    borderWidth: 3,
                    fontSize: 28,
                    fontWeight: '900',
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,255,255,0.95)',
                  },
                  // ⬇️ Oben rechts, am Rand zentriert – bewegt sich mit der Karte
                  wrapper: {
                    position: 'absolute',
                    top: 18,
                    right: 18,
                    transform: [{ rotate: '12deg' }],
                    alignItems: 'flex-end',
                  },
                },
              },
              // Like-Label (Swipe nach rechts): oben links, gleiches Design – nur in App-Blau
              right: {
                title: 'Like',
                style: {
                  label: {
                    borderColor: PRIMARY,
                    color: PRIMARY,
                    borderWidth: 3,
                    fontSize: 28,
                    fontWeight: '900',
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,255,255,0.95)',
                  },
                  wrapper: {
                    position: 'absolute',
                    top: 18,
                    left: 18,
                    transform: [{ rotate: '-12deg' }],
                    alignItems: 'flex-start',
                  },
                },
              },
            }}
            stackSize={4}
            stackSeparation={15}
            backgroundColor="transparent"
            animateCardOpacity
            cardIndex={0}
            verticalSwipe={false}
            cardVerticalMargin={40}
          />
        )}
      </View>

      {/* kleiner Bottom-Hint (dezent) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bottomHint,
          {
            opacity: bottomHintAnim,
            transform: [{
              translateY: bottomHintAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          },
        ]}
      >
        <Ionicons name="swap-horizontal-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.bottomHintText}>
          {translate('swipe_hint_title')}
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f2f2' },

  header: {
    backgroundColor: 'transparent',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: PRIMARY,
    textAlign: 'center',
  },

  centerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  hintCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  hintIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  hintDivider: { color: '#fff', fontSize: 22, marginHorizontal: 6, opacity: 0.85 },
  hintTitle: { color: '#fff', fontWeight: '800', fontSize: 16, textAlign: 'center' },
  hintSub: { color: 'rgba(255,255,255,0.9)', marginTop: 6, fontSize: 12 },
  hintCloseBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  hintCloseText: { color: '#fff', fontWeight: '700' },

  swiperWrapper: { flex: 1, paddingHorizontal: 20, marginBottom: 70 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    height: 520,
  },
  image: {
    width: width * 0.8,
    height: width * 0.5,
    borderRadius: 12,
    marginBottom: 15,
    resizeMode: 'cover',
  },
  placeholder: { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#888', fontSize: 14 },

  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },

  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  sub: { fontSize: 14, color: '#666' },
  tag: {
    backgroundColor: '#e6f2fb',
    color: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 14,
    overflow: 'hidden',
  },

  // ★ Beschreibung unten
  descBox: {
    marginTop: 12,
    backgroundColor: '#f7fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5edf5',
    width: '100%',
  },
  descText: { color: '#334155', fontSize: 14, lineHeight: 20 },

  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:   { fontSize: 16, color: '#999' },

  bottomHint: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomHintText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
});
