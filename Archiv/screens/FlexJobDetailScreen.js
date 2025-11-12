// screens/FlexJobDetailScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import i18n from '../i18n';

const COLOR = {
  bg: '#f4f6fb',
  white: '#fff',
  primary: '#4db3f4',
  text: '#0f172a',
  sub: '#64748b',
};

export default function FlexJobDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const session = route?.params?.session ?? null;
  const flexJobFromParams = route?.params?.flexJob ?? null;
  const flexJobIdFromParams = route?.params?.flexJobId ?? null;

  const [flexJob, setFlexJob] = useState(flexJobFromParams);
  const [loading, setLoading] = useState(!flexJobFromParams);
  const [actionLoading, setActionLoading] = useState(false);

  // wenn wir KEIN Objekt haben, aber eine ID → vom Server holen
  useEffect(() => {
    if (flexJobFromParams) return; // wir haben ja schon alles

    if (!flexJobIdFromParams) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('flex_jobs')
        .select('*')
        .eq('id', flexJobIdFromParams)
        .maybeSingle();

      if (error) {
        console.log('flex job load error', error.message);
        setFlexJob(null);
      } else {
        setFlexJob(data);
      }
      setLoading(false);
    })();
  }, [flexJobFromParams, flexJobIdFromParams]);

  function formatDate(val) {
    if (!val) return '—';
    try {
      const d = new Date(val);
      return d.toLocaleString(i18n.locale === 'de' ? 'de-DE' : 'en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '—';
    }
  }

  async function togglePause() {
    if (!flexJob?.id) return;
    const nextStatus = flexJob.status === 'open' ? 'paused' : 'open';

    setActionLoading(true);
    const { error } = await supabase
      .from('flex_jobs')
      .update({ status: nextStatus })
      .eq('id', flexJob.id);
    setActionLoading(false);

    if (error) {
      // dein Trigger-Fehler
      if (error.message?.includes('updated_at')) {
        setFlexJob({ ...flexJob, status: nextStatus });
        return;
      }
      Alert.alert(i18n.t('flex.detail.errorTitle'), i18n.t('flex.detail.errorUpdate'));
      return;
    }

    setFlexJob({ ...flexJob, status: nextStatus });
  }

  function confirmDelete() {
    if (!flexJob?.id) return;
    Alert.alert(
      i18n.t('flex.detail.deleteTitle'),
      i18n.t('flex.detail.deleteText'),
      [
        { text: i18n.t('flex.detail.cancel'), style: 'cancel' },
        {
          text: i18n.t('flex.detail.deleteConfirm'),
          style: 'destructive',
          onPress: handleDelete,
        },
      ]
    );
  }

  async function handleDelete() {
    if (!flexJob?.id) return;
    setActionLoading(true);
    const { error } = await supabase.from('flex_jobs').delete().eq('id', flexJob.id);
    setActionLoading(false);

    if (error) {
      if (error.message?.includes('updated_at')) {
        navigation.goBack();
        return;
      }
      Alert.alert(i18n.t('flex.detail.errorTitle'), i18n.t('flex.detail.errorDelete'));
      return;
    }
    navigation.goBack();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLOR.primary} />
      </SafeAreaView>
    );
  }

  if (!flexJob) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLOR.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{i18n.t('flex.detail.title')}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={[styles.center, { backgroundColor: COLOR.bg }]}>
          <Text style={{ color: COLOR.sub }}>{i18n.t('flex.detail.errorLoad')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLOR.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{i18n.t('flex.detail.title')}</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('FlexJobCreate', {
              session,
              flexJobId: flexJob.id,
            })
          }
        >
          <Ionicons name="create-outline" size={20} color={COLOR.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }}>
        {/* Kopf */}
        <View style={styles.topCard}>
          <Text style={styles.jobTitle}>{flexJob.title || i18n.t('flex.fallbackTitle')}</Text>
          <Text style={styles.jobMeta}>
            {i18n.t('flex.detail.createdAtPrefix')} {formatDate(flexJob.created_at)}
          </Text>
          <Text style={styles.jobMeta}>
            {i18n.t('flex.detail.location')} {flexJob.address_city || '—'}
          </Text>

          <View
            style={[
              styles.statusPill,
              flexJob.status === 'open'
                ? { backgroundColor: '#dcfce7' }
                : flexJob.status === 'paused'
                ? { backgroundColor: '#e2e8f0' }
                : { backgroundColor: '#fee2e2' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                flexJob.status === 'open'
                  ? { color: '#047857' }
                  : flexJob.status === 'paused'
                  ? { color: '#475569' }
                  : { color: '#b91c1c' },
              ]}
            >
              {flexJob.status === 'open'
                ? i18n.t('flex.detail.statusOpen')
                : flexJob.status === 'paused'
                ? i18n.t('flex.detail.statusPaused')
                : i18n.t('flex.detail.statusClosed')}
            </Text>
          </View>
        </View>

        {/* Rahmendaten */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('flex.detail.sectionBasics')}</Text>

          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="time-outline" size={18} color={COLOR.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{i18n.t('flex.detail.startAt')}</Text>
              <Text style={styles.infoValue}>{formatDate(flexJob.start_at)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="location-outline" size={18} color={COLOR.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{i18n.t('flex.detail.address')}</Text>
              <Text style={styles.infoValue}>
                {flexJob.address_street
                  ? `${flexJob.address_street}${flexJob.address_zip ? ', ' + flexJob.address_zip : ''}${flexJob.address_city ? ' ' + flexJob.address_city : ''}`
                  : flexJob.address_city || '—'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="cash-outline" size={18} color={COLOR.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{i18n.t('flex.detail.hourlyRate')}</Text>
              <Text style={styles.infoValue}>
                {flexJob.hourly_rate ? `${flexJob.hourly_rate} €` : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="hourglass-outline" size={18} color={COLOR.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{i18n.t('flex.detail.hoursNeeded')}</Text>
              <Text style={styles.infoValue}>
                {flexJob.hours_needed ? `${flexJob.hours_needed}h` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Aufgaben */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('flex.detail.tasks')}</Text>
          <Text style={styles.infoValue}>
            {flexJob.tasks || flexJob.description || '—'}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.bottomBtn, { backgroundColor: '#0ea5e9' }]}
          onPress={togglePause}
          disabled={actionLoading}
        >
          <Text style={styles.bottomBtnText}>
            {flexJob.status === 'open'
              ? i18n.t('flex.detail.btnPause')
              : i18n.t('flex.detail.btnActivate')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, { backgroundColor: '#e2e8f0' }]}
          onPress={() =>
            navigation.navigate('FlexJobCreate', {
              session,
              flexJobId: flexJob.id,
            })
          }
        >
          <Text style={[styles.bottomBtnText, { color: '#0f172a' }]}>
            {i18n.t('flex.detail.btnEdit')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, { backgroundColor: '#ef4444' }]}
          onPress={confirmDelete}
          disabled={actionLoading}
        >
          <Text style={styles.bottomBtnText}>{i18n.t('flex.detail.btnDelete')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.white },

  header: {
    backgroundColor: COLOR.white,
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLOR.primary },

  topCard: {
    backgroundColor: COLOR.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  jobTitle: { fontSize: 20, fontWeight: '700', color: COLOR.text, marginBottom: 4 },
  jobMeta: { color: COLOR.sub, marginBottom: 2 },

  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 10,
  },
  statusText: { fontWeight: '600', fontSize: 13 },

  section: {
    backgroundColor: COLOR.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: COLOR.text },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e6f2fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoLabel: { fontSize: 12, color: COLOR.sub },
  infoValue: { fontSize: 14, color: COLOR.text, fontWeight: '500', marginTop: 2 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    padding: 12,
  },
  bottomBtn: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  bottomBtnText: { color: '#fff', fontWeight: '600' },
});
