// screens/EmployerMatchesScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { supabase } from '../supabaseClient';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function EmployerMatchesScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // 1) Session evtl. aus Params …
  const sessionFromParams = route?.params?.session ?? null;
  const [session, setSession] = useState(sessionFromParams);

  // 2) … oder frisch holen
  useEffect(() => {
    if (!session) {
      (async () => {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data?.session) setSession(data.session);
      })();
    }
  }, [session]);

  const employerId = session?.user?.id;

  const [matches, setMatches] = useState([]);
  const [plan, setPlan] = useState('free'); // free | premium | platinum
  const [monthlyUnlockedCount, setMonthlyUnlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    await Promise.all([fetchPlan(), fetchCounts(), fetchMatches()]);
  }, []);

  useEffect(() => {
    if (!employerId) return;
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [employerId, loadAll]);

  async function fetchPlan() {
    if (!employerId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', employerId)
      .maybeSingle();
    if (!error && data) setPlan(data.plan || 'free');
  }

  async function fetchCounts() {
    if (!employerId) return;
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('employer_unlocked', true)
      .eq('employer_payment_status', 'paid')
      .gte('employer_unlocked_at', monthStart.toISOString())
      .eq('employer_id', employerId);

    if (!error && typeof count === 'number') setMonthlyUnlockedCount(count);
  }

  async function fetchMatches() {
    if (!employerId) return;
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id,
        employer_id,
        employee_id,
        initiator,
        status,
        employer_unlocked,
        employer_payment_status,
        employer_price_charged,
        employee:employee_id ( id, first_name, last_name, avatar_url, job_title ),
        match_percentage
      `)
      .eq('employer_id', employerId)
      .eq('status', 'confirmed')
      .order('id', { ascending: false });

    if (!error) setMatches(data ?? []);
  }

  const computePrice = useMemo(
    () => (plan, unlockedCountSoFar) => {
      if (plan === 'platinum') return 0;
      if (plan === 'premium') return unlockedCountSoFar < 10 ? 0 : 29;
      return 49.99;
    },
    []
  );

  function getUnlockState(m) {
    const employerWasSecond = m.initiator && m.initiator !== employerId;
    if (employerWasSecond) {
      return { unlocked: true, price: 0, reason: 'already_paid_on_swipe' };
    }
    if (m.employer_unlocked) {
      return { unlocked: true, price: m.employer_price_charged ?? 0, reason: 'already_unlocked' };
    }
    const price = computePrice(plan, monthlyUnlockedCount);
    return { unlocked: false, price, reason: 'needs_unlock' };
  }

  async function handleUnlock(m) {
    const state = getUnlockState(m);
    if (state.unlocked) return;

    if (state.price === 0) {
      const { error } = await supabase
        .from('matches')
        .update({
          employer_unlocked: true,
          employer_unlocked_at: new Date().toISOString(),
          employer_payment_status: 'free',
          employer_price_charged: 0,
        })
        .eq('id', m.id);

      if (error) {
        Alert.alert('Fehler', 'Konnte nicht freischalten.');
        return;
      }

      await supabase.from('match_payments').insert({
        match_id: m.id,
        employer_id: employerId,
        amount: 0,
        status: 'free',
      });

      await loadAll();
      return;
    }

    navigation.navigate('PaymentScreen', {
      matchId: m.id,
      amount: state.price,
      plan,
      employee: m.employee,
    });
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const renderMatch = ({ item }) => {
    const employee = item.employee;
    const state = getUnlockState(item);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          if (state.unlocked) {
            navigation.navigate('ChatDetail', {
              matchId: item.id,
              otherUser: {
                id: employee?.id,
                name: `${employee?.first_name ?? ''} ${employee?.last_name ?? ''}`.trim() || 'Kandidat',
                avatar: employee?.avatar_url || null,
              },
              role: 'employer',
            });
          } else {
            Alert.alert(
              'Noch nicht freigeschaltet',
              'Schalte das Match frei, um mit diesem Kandidaten zu chatten.'
            );
          }
        }}
      >
        <View style={styles.profileRow}>
          <Image
            source={{ uri: employee?.avatar_url || 'https://i.pravatar.cc/100?img=11' }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {employee?.first_name} {employee?.last_name}
            </Text>
            <Text style={styles.job}>{employee?.job_title || 'Berufsbezeichnung'}</Text>
          </View>
          <View style={styles.matchBadge}>
            <Text style={styles.matchText}>{item.match_percentage ?? 0}% Match</Text>
          </View>
        </View>

        {state.unlocked ? (
          <View style={[styles.unlockButton, { backgroundColor: '#dff3df' }]}>
            <Text style={[styles.unlockText, { color: '#2e7d32' }]}>Freigeschaltet</Text>
            {state.reason === 'already_paid_on_swipe' ? (
              <Text style={[styles.unlockSub, { color: '#2e7d32' }]}>beim Swipe bezahlt</Text>
            ) : (
              <Text style={[styles.unlockSub, { color: '#2e7d32' }]}>
                bezahlt: {Number(state.price).toFixed(2)} €
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.unlockButton} onPress={() => handleUnlock(item)}>
            <Text style={styles.unlockText}>
              {plan === 'platinum' || (plan === 'premium' && monthlyUnlockedCount < 10)
                ? 'Kostenlos freischalten'
                : `Für ${Number(state.price).toFixed(2)} € freischalten`}
            </Text>
            <Text style={styles.unlockSub}>Kontaktdaten freischalten</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ----------- UI -----------
  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Text style={styles.headerTitle}>jatch</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4db3f4" />
          <Text style={{ marginTop: 8, color: '#666' }}>Lade Sitzung…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header wie auf den anderen Pages */}
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>jatch</Text>
        {/* optional: Refresh-Button rechts */}
        <TouchableOpacity onPress={onRefresh} accessibilityLabel="Aktualisieren">
          <Ionicons name="refresh" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4db3f4" />
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderMatch}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="sparkles-outline" size={28} color="#4db3f4" />
              <Text style={styles.emptyTitle}>Noch keine Matches</Text>
              <Text style={styles.emptyText}>
                Starte mit dem Swipen, um passende Kandidaten zu finden.
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => navigation.navigate('SwipesTab')}
              >
                <Ionicons name="flash-outline" size={18} color="#fff" />
                <Text style={styles.ctaText}>Jetzt swipen</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f8fb' },

  // Header identisch wie bei Swipes
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

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e5e7eb', marginRight: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  job: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  matchBadge: { backgroundColor: '#4db3f4', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  matchText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  unlockButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  unlockSub: { fontSize: 12, color: '#374151', marginTop: 2 },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingTop: 32,
  },
  emptyTitle: { marginTop: 8, fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyText: { marginTop: 4, fontSize: 13, color: '#6b7280', textAlign: 'center' },
  cta: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4db3f4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700', marginLeft: 8 },
});
