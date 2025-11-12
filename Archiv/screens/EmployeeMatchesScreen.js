// screens/EmployeeMatchesScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { supabase } from '../supabaseClient';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function EmployeeMatchesScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const sessionFromParams = route?.params?.session ?? null;
  const [session, setSession] = useState(sessionFromParams);

  useEffect(() => {
    if (!session) {
      (async () => {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data?.session) setSession(data.session);
      })();
    }
  }, [session]);

  const employeeId = session?.user?.id;

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = useCallback(async () => {
    if (!employeeId) return;
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
        employer:employer_id ( id, company_name, company_logo_url ),
        match_percentage
      `)
      .eq('employee_id', employeeId)
      .eq('status', 'confirmed')
      .order('id', { ascending: false });

    if (!error) setMatches(data ?? []);
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) return;
    (async () => {
      setLoading(true);
      await loadMatches();
      setLoading(false);
    })();
  }, [employeeId, loadMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  }, [loadMatches]);

  const renderMatch = ({ item }) => {
  const employer = item.employer;
  const isUnlocked =
    item.employer_unlocked ||
    item.employer_payment_status === 'free' ||
    item.employer_payment_status === 'paid';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => {
        if (isUnlocked) {
          navigation.navigate('ChatDetail', {
            matchId: item.id,
            otherUser: {
              id: employer?.id,
              name: employer?.company_name || 'Arbeitgeber',
              avatar: employer?.company_logo_url || null,
            },
            role: 'employee',
          });
        } else {
          // Freundliche Meldung statt Chat
          Alert.alert(
            'Noch nicht freigeschaltet',
            'Warte, bis der Arbeitgeber das Match bestätigt.'
          );
        }
      }}
    >
      <View style={styles.profileRow}>
        <Image
          source={{ uri: employer?.company_logo_url || 'https://i.pravatar.cc/100?img=11' }}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {employer?.company_name || 'Arbeitgeber'}
          </Text>
          <Text style={styles.job}>
            {isUnlocked
              ? 'Jetzt im Chat verfügbar'
              : 'Warte, bis der Arbeitgeber das Match bestätigt'}
          </Text>
        </View>
        <View style={styles.matchBadge}>
          <Text style={styles.matchText}>{item.match_percentage ?? 0}% Match</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};


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
      {/* Header wie gewohnt */}
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>jatch</Text>
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
                Starte mit dem Swipen, um deinen nächsten Job zu finden.
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
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e5e7eb', marginRight: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  job: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  matchBadge: { backgroundColor: '#4db3f4', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  matchText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  emptyBox: { alignItems: 'center', paddingTop: 32 },
  emptyTitle: { marginTop: 8, fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyText: { marginTop: 4, fontSize: 13, color: '#6b7280', textAlign: 'center' },
  cta: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4db3f4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700', marginLeft: 8 },
});
