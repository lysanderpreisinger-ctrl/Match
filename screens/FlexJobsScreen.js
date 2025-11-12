// screens/FlexJobsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import i18n from '../i18n';

const COLOR = {
  bg: '#f4f6fb',
  white: '#fff',
  primary: '#4db3f4',
  text: '#0f172a',
  sub: '#64748b',
};

function t(key, fallback) {
  const val = i18n?.t ? i18n.t(key) : key;
  if (typeof val === 'string' && !val.startsWith('[missing')) return val;
  return fallback || key;
}

export default function FlexJobsScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const sessionFromParams = route?.params?.session ?? null;
  const roleFromParams = route?.params?.role ?? 'employer';

  const [session, setSession] = useState(sessionFromParams);
  const [role, setRole] = useState(roleFromParams);
  const [loadingSession, setLoadingSession] = useState(!sessionFromParams);

  const [flexJobs, setFlexJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const isEmployer = role === 'employer';

  // Session nachladen, falls Screen direkt geöffnet
  useEffect(() => {
    if (!session) {
      (async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setSession(data.session);
          if (!role) {
            // ggf. Rolle aus Profil holen
            const { data: prof } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', data.session.user.id)
              .maybeSingle();
            setRole((prof?.role || 'employee').toLowerCase());
          }
        }
        setLoadingSession(false);
      })();
    } else {
      setLoadingSession(false);
    }
  }, [session, role]);

  const loadFlexJobs = useCallback(
    async (userId, currentRole) => {
      setLoading(true);

      // Arbeitgeber: nur eigene Flex-Jobs
      if (currentRole === 'employer') {
        const { data, error } = await supabase
          .from('flex_jobs')
          .select('*')
          .eq('employer_id', userId)
          .order('start_at', { ascending: true });

        if (error) {
          console.log('Fehler beim Laden der eigenen flex_jobs:', error.message);
          setFlexJobs([]);
        } else {
          setFlexJobs(data || []);
        }
      } else {
        // Arbeitnehmer: alle offenen Flex-Jobs
        const { data, error } = await supabase
          .from('flex_jobs')
          .select('*')
          .eq('status', 'open')
          .order('start_at', { ascending: true });

        if (error) {
          console.log('Fehler beim Laden aller flex_jobs:', error.message);
          setFlexJobs([]);
        } else {
          setFlexJobs(data || []);
        }
      }

      setLoading(false);
    },
    []
  );

  // beim ersten Mount
  useEffect(() => {
    if (session?.user?.id) {
      loadFlexJobs(session.user.id, role);
    }
  }, [session?.user?.id, role, loadFlexJobs]);

  // beim Zurückkommen neu laden
  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        loadFlexJobs(session.user.id, role);
      }
    }, [session?.user?.id, role, loadFlexJobs])
  );

  function handleCreateFlexJob() {
    if (!isEmployer) return;
    navigation.navigate('FlexJobCreate', { session });
  }

  function formatStart(item) {
    if (!item?.start_at) return t('flex.startNow', 'sofort');
    try {
      const d = new Date(item.start_at);
      return d.toLocaleString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return t('flex.startNow', 'sofort');
    }
  }

    function renderFlexJob({ item }) {
    return (
      <TouchableOpacity
        style={styles.jobCard}
        onPress={() =>
          navigation.navigate('FlexJobDetail', {
            id: item.id,
            session,
            role: 'employer',
          })
        }
        activeOpacity={0.85}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.jobIcon}>
            <Ionicons name="flash-outline" size={22} color={COLOR.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.jobTitle}>{item.title || 'Flex-Job'}</Text>
            <Text style={styles.jobMeta}>
              {formatStart(item)} · {item.address_city || 'Ort offen'}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: item.status === 'open' ? '#dcfce7' : '#e2e8f0' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: item.status === 'open' ? '#047857' : '#64748b' },
              ]}
            >
              {item.status === 'open' ? 'Online' : 'Geschlossen'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }


  if (loadingSession || loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLOR.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header wie im Screenshot (Page 1) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLOR.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('flex.title', 'Flex-Jobs')}
        </Text>
        {/* Platzhalter rechts */}
        <View style={{ width: 22 }} />
      </View>

      {/* nur für Arbeitgeber sichtbar */}
      {isEmployer && (
        <TouchableOpacity
          style={styles.createCard}
          onPress={handleCreateFlexJob}
          activeOpacity={0.88}
        >
          <View style={styles.createIcon}>
            <Ionicons name="add" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.createTitle}>
              {t('flex.createNew', 'Neuen Flex-Job erstellen')}
            </Text>
            <Text style={styles.createSub}>
              {t('flex.createSub', 'Kurzfristige Aushilfen schnell posten')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
        </TouchableOpacity>
      )}

      {/* Liste */}
      <FlatList
        data={flexJobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderFlexJob}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="flash-outline"
              size={30}
              color={COLOR.primary}
              style={{ marginBottom: 6 }}
            />
            <Text style={styles.emptyTitle}>
              {isEmployer
                ? t('flex.emptyEmployerTitle', 'Noch keine Flex-Jobs')
                : t('flex.emptyEmployeeTitle', 'Keine Flex-Jobs gefunden')}
            </Text>
            <Text style={styles.emptySub}>
              {isEmployer
                ? t('flex.emptyEmployerSub', 'Erstelle oben deinen ersten Flex-Job.')
                : t('flex.emptyEmployeeSub', 'Schau später nochmal rein.')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: COLOR.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLOR.primary,
  },
  createCard: {
    backgroundColor: COLOR.white,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  createIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLOR.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTitle: { fontSize: 16, fontWeight: '700', color: COLOR.text },
  createSub: { fontSize: 12, color: COLOR.sub, marginTop: 2 },

  jobCard: {
    backgroundColor: COLOR.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  jobIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e6f2fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  jobTitle: { fontSize: 15, fontWeight: '600', color: COLOR.text },
  jobMeta: { fontSize: 12, color: COLOR.sub, marginTop: 3 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 12, fontWeight: '600' },

  emptyBox: {
    backgroundColor: COLOR.white,
    borderRadius: 16,
    padding: 20,
    marginTop: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLOR.text, marginBottom: 4 },
  emptySub: { color: COLOR.sub, fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLOR.white },
});
