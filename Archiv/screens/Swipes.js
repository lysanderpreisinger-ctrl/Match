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
} from 'react-native';
import Swiper from 'react-native-deck-swiper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import { calculateMatchScore, handleEmployerSecondSwipe } from '../utils/matching';

const { width } = Dimensions.get('window');

const TRANSLATIONS = {
  de: {
    no_results: 'Keine passenden Ergebnisse gefunden',
    no_cards_anymore: 'Keine Karten mehr',
    not_logged_in: 'Nicht angemeldet',
    please_login: 'Bitte melde dich an, bevor du swipest.',
    swipe_hint_title: 'Nach rechts = gefällt · nach links = verwerfen',
  },
  en: {
    no_results: 'No matching results found',
    no_cards_anymore: 'No more cards',
    not_logged_in: 'Not logged in',
    please_login: 'Please log in before swiping.',
    swipe_hint_title: 'Swipe right = like · left = skip',
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
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Swipes({ route }) {
  const paramsSession = route?.params?.session ?? null;
  const paramsRole    = route?.params?.role ?? null;
  const paramsFilters = route?.params?.filters ?? null;
  const showOnboardingHint = route?.params?.showOnboardingHint === true;

  const navigation = useNavigation();
  const swiperRef = useRef(null);

  const [session, setSession] = useState(paramsSession);
  const [effectiveRole, setEffectiveRole] = useState(paramsRole ?? 'employee');
  const [filters, setFilters] = useState(paramsFilters);

  const [cards, setCards] = useState(null);
  const [loadingRole, setLoadingRole] = useState(!paramsRole || !paramsSession);

  // oben: blauer Hinweis
  const [showHint, setShowHint] = useState(false);
  const bannerAnim = useRef(new Animated.Value(0)).current;

  // unten: swipe-hinweis
  const bottomHintAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showOnboardingHint) {
      setShowHint(true);
      Animated.timing(bannerAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [showOnboardingHint, bannerAnim]);

  // beim Mount: unteren Hinweis einblenden -> 3s -> ausblenden
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
      }, 3000);
    });
  }, [bottomHintAnim]);

  const closeHint = () => {
    Animated.timing(bannerAnim, {
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

  // wenn Filter kommen
  useEffect(() => {
    if (route?.params?.filters !== undefined) {
      setFilters(route.params.filters);
    }
  }, [route?.params?.filters]);

  // Daten nachladen
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
      // Arbeitnehmer sieht Jobs
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
      // Arbeitgeber sieht Kandidaten
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
        .eq('visibility_jobs', true); // ⬅️ nur die, die sich für Stellenanzeigen sichtbar gemacht haben

      if (employment_type) {
        query = query.contains('employment_type', [employment_type]);
      }
      if (industry) {
        query = query.eq('industry', industry);
      }
      if (availability) {
        query = query.eq('availability', availability);
      }
      if (typeof min_experience_years === 'number' && min_experience_years > 0) {
        query = query.gte('experience_years', min_experience_years);
      }
      if (typeof german_level_1_10 === 'number' && german_level_1_10 > 1) {
        query = query.gte('german_level_1_10', german_level_1_10);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Profiles-Filter-Error:', error);
        setCards([]);
        return;
      }

      let base = Array.isArray(data) ? data : [];

      if (base.length === 0) {
        // Fallback: trotzdem alle holen, die sichtbar sind
        const { data: allEmployees, error: allErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'employee')
          .eq('visibility_jobs', true);
        if (allErr) {
          console.error('Profiles-Fallback-Error:', allErr);
          setCards([]);
          return;
        }
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

      if (session?.user?.id) {
        query = query.neq('employer_id', session.user.id);
      }

      const { data, error } = await query;
      if (error) { console.error('Jobs-Default-Error:', error); setCards([]); return; }
      setCards(Array.isArray(data) ? data : []);
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee')
        .eq('visibility_jobs', true); // ⬅️ auch im Default nur sichtbare
      if (error) { console.error('Profiles-Default-Error:', error); setCards([]); return; }
      setCards(Array.isArray(data) ? data : []);
    }
  }

  // ---------- Swipe-Handler ----------
  const onSwipedLeft = async (idx) => { await recordSwipe(idx, 'skip'); };

  const onSwipedRight = async (idx) => {
    const matchId = await recordSwipe(idx, 'like');
    if (effectiveRole === 'employer' && matchId) {
      await handleEmployerSecondSwipe({
        employerId: session?.user?.id,
        matchId,
        navigation,
      });
    }
  };

  const recordSwipe = async (idx, direction) => {
    const card = cards?.[idx];
    if (!card) return null;

    const swiperId = session?.user?.id;
    if (!swiperId) {
      Alert.alert(translate('not_logged_in'), translate('please_login'));
      return null;
    }

    const targetType = effectiveRole === 'employer' ? 'profile' : 'job';

    const { error: swipeErr } = await supabase.from('swipes').insert({
      swiper_id: swiperId,
      target_id: card.id,
      target_type: targetType,
      direction,
    });
    if (swipeErr) { console.error('Swipe-Error:', swipeErr); return null; }

    if (!(effectiveRole === 'employer' && direction === 'like')) return null;

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
    return matchInsert?.id ?? null;
  };

  // ---------- Karte klickbar machen ----------
  const handleCardPress = (card) => {
    if (!card) return;
    if (effectiveRole === 'employer') {
      navigation.navigate('EmployeeProfileViewScreen', {
        profileId: card.id,
        from: 'Swipes',
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

    const daysAgo = card?.created_at
      ? Math.floor((Date.now() - new Date(card.created_at).getTime()) / 86400000)
      : null;

    const hasImage = effectiveRole === 'employer' ? !!card?.avatar_url : !!card?.company_logo_url;
    const imageUri = effectiveRole === 'employer' ? card?.avatar_url : card?.company_logo_url;

    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => handleCardPress(card)}>
        <View style={styles.card}>
          {hasImage ? (
            <Image source={{ uri: imageUri }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Text style={styles.placeholderText}>
                {effectiveRole === 'employer' ? 'Kein Bild' : 'Kein Logo'}
              </Text>
            </View>
          )}

          <Text style={styles.title}>
            {effectiveRole === 'employer'
              ? `${card?.first_name ?? ''} ${card?.last_name ?? ''}`.trim() || 'Profil'
              : card?.title || 'Stellenanzeige'}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.sub}>
              {(effectiveRole === 'employer' ? card?.education : card?.company_name) || '—'}
            </Text>

            {!!card?.employment_type && (
              <Text style={styles.tag}>
                {Array.isArray(card.employment_type)
                  ? card.employment_type[0]
                  : String(card.employment_type)}
              </Text>
            )}

            {daysAgo !== null && (
              <Text style={styles.sub}>
                {daysAgo === 0 ? 'Heute inseriert' : `${daysAgo} Tage her`}
              </Text>
            )}
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
          <View style={{ width: 24 }} />
          <Text style={styles.headerTitle}>jatch</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loading}><ActivityIndicator size="large" color="#4db3f4" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={{ width: 24 }} />
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
          <Ionicons name="options-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {showHint && (
        <Animated.View
          style={[
            styles.hintContainer,
            {
              opacity: bannerAnim,
              transform: [{
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              }],
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.hintText}>
            Tipp: Vervollständige zuerst dein Profil in der Profil-Seite,
            bevor du mit dem Swipen beginnst.
          </Text>
          <TouchableOpacity onPress={closeHint} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={styles.swiperWrapper}>
        {cards === null ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#4db3f4" />
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
            onSwipedLeft={onSwipedLeft}
            onSwipedRight={onSwipedRight}
            onSwipedAll={() => Alert.alert(translate('no_cards_anymore'))}
            overlayLabels={{
              left:  { title: 'Verwerfen', style: { label: { borderColor: 'red',   color: 'red'   } } },
              right: { title: 'Gefällt',  style: { label: { borderColor: 'green', color: 'green' } } },
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

      {/* unteres, kurz eingeblendetes Hint-Feld */}
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
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4db3f4',
    textAlign: 'center',
    flex: 1,
  },
  hintContainer: {
    backgroundColor: '#4db3f4',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintText: { color: '#fff', flex: 1, fontSize: 13 },
  closeBtn: { padding: 4, marginLeft: 8 },
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
    height: 480,
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
  },
  sub: { fontSize: 14, color: '#666', marginRight: 12 },
  tag: {
    backgroundColor: '#e0e7ff',
    color: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 14,
    overflow: 'hidden',
    marginRight: 12,
  },
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
