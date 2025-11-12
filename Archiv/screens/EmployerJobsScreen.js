// screens/EmployerJobsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';
import i18n from '../i18n';

export default function EmployerJobsScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Session kann vom vorherigen Screen kommen
  const sessionFromParams = route?.params?.session ?? null;
  const [session, setSession] = useState(sessionFromParams);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Session nachladen, falls nicht übergeben
  useEffect(() => {
    if (!session) {
      (async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session) setSession(data.session);
      })();
    }
  }, [session]);

  // Jobs ziehen – als Callback, damit wir es bei Fokus & Pull benutzen können
  const fetchJobs = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, employment_type, created_at, is_active, company_logo_url, location_city, available_now, latitude, longitude'
      )
      .eq('employer_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Laden der Stellen:', error);
      setJobs([]);
    } else {
      setJobs(data ?? []);
    }
    setLoading(false);
  }, [session?.user?.id]);

  // Erstes Laden
  useEffect(() => {
    if (session?.user?.id) {
      fetchJobs();
    }
  }, [session?.user?.id, fetchJobs]);

  // WICHTIG: jedes Mal neu laden, wenn die Seite wieder im Fokus ist
  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        fetchJobs();
      }
    }, [session?.user?.id, fetchJobs])
  );

  // Falls jemand dich mit forceReload aufruft
  useEffect(() => {
    if (route?.params?.forceReload && session?.user?.id) {
      fetchJobs();
    }
  }, [route?.params?.forceReload, session?.user?.id, fetchJobs]);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }, [fetchJobs]);

  // Navigationen
  const goDetail = (jobId) =>
    navigation.navigate('JobDetailScreen', { jobId, session });

  const goEdit = (jobId) =>
    navigation.navigate('JobEditorScreen', { jobId, session });

  const goCreate = () =>
    navigation.navigate('JobEditorScreen', { session });

  const goMatch = (job) => {
    const filters = {
      availability: job.available_now ? 'sofort' : null,
      location:
        job.latitude && job.longitude
          ? { latitude: job.latitude, longitude: job.longitude }
          : null,
      radius: 50,
    };
    navigation.navigate('Swipes', {
      screen: 'Swipes',
      params: { role: 'employer', session, filters },
    });
  };

  // Einzelnes Job-Card rendern
  const renderJob = ({ item }) => {
    const created = item.created_at ? new Date(item.created_at) : null;
    const createdStr = created
      ? created.toLocaleDateString([], {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

    return (
      <TouchableOpacity
        style={styles.jobCard}
        activeOpacity={0.85}
        onPress={() => goDetail(item.id)}
        onLongPress={() => goEdit(item.id)}
      >
        {/* Logo / Platzhalter */}
        {item.company_logo_url ? (
          <Image source={{ uri: item.company_logo_url }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoPlaceholder]}>
            <Ionicons name="briefcase-outline" size={20} color="#9ca3af" />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {item.title || i18n.t('employerJobs.defaultTitle')}
          </Text>
          <View style={styles.row}>
            {item.employment_type?.length ? (
              <Text style={styles.pill}>{item.employment_type}</Text>
            ) : null}
            {!!item.location_city && (
              <Text style={styles.meta}>{item.location_city}</Text>
            )}
            {!!createdStr && <Text style={styles.meta}>· {createdStr}</Text>}
          </View>
        </View>

        {/* Status & Quick Actions */}
        <View style={styles.rightCol}>
          <View
            style={[
              styles.statusBadge,
              item.is_active ? styles.statusOn : styles.statusOff,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                item.is_active ? styles.statusTextOn : styles.statusTextOff,
              ]}
            >
              {item.is_active
                ? i18n.t('employerJobs.statusOnline')
                : i18n.t('employerJobs.statusOffline')}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => goMatch(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="people-outline" size={18} color="#4db3f4" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Wenn Session noch nicht da:
  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4db3f4" />
        <Text style={styles.centerText}>
          {i18n.t('employerJobs.loadingSession')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#4db3f4" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{i18n.t('employerJobs.title')}</Text>

        {/* Platzhalter, damit Titel mittig bleibt */}
        <View style={{ width: 24 }} />
      </View>

      {/* CTA: Neue Stellenanzeige */}
      <TouchableOpacity
        style={styles.createBox}
        activeOpacity={0.9}
        onPress={goCreate}
      >
        <View style={styles.createIconWrap}>
          <Ionicons name="add" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.createTitle}>
            {i18n.t('employerJobs.createTitle')}
          </Text>
          <Text style={styles.createSubtitle}>
            {i18n.t('employerJobs.createSubtitle')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#4db3f4" />
      </TouchableOpacity>

      {/* Liste */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4db3f4" />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{i18n.t('employerJobs.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4db3f4"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fb' },
  backBtn: { padding: 4, marginRight: 8 },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#4db3f4' },

  createBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  createIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4db3f4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  createSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f3f4f6',
  },
  logoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  jobTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  pill: {
    backgroundColor: '#e0e7ff',
    color: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    fontSize: 12,
    overflow: 'hidden',
    marginRight: 8,
  },
  meta: { fontSize: 12, color: '#6b7280', marginRight: 8 },

  rightCol: { alignItems: 'flex-end', justifyContent: 'center' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusOn: { backgroundColor: '#e6f6ec' },
  statusOff: { backgroundColor: '#f3f4f6' },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusTextOn: { color: '#2e7d32' },
  statusTextOff: { color: '#6b7280' },

  quickBtn: {
    backgroundColor: '#e6f2fb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  centerText: { marginTop: 8, color: '#666' },

  emptyWrap: { padding: 16, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 14, textAlign: 'center' },
});
