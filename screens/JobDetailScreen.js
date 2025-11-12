// screens/JobDetailScreen.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';
import i18n from '../i18n';

const C = {
  bg: '#f7f8fb',
  white: '#fff',
  line: '#e5e7eb',
  primary: '#4db3f4',
  text: '#0f172a',
  sub: '#64748b',
  dangerBg: '#fee2e2',
  danger: '#ef4444',
  dark: '#111827',
};

export default function JobDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const sessionFromParams = route?.params?.session ?? null;
  const jobId = route?.params?.jobId ?? null;

  const [session, setSession] = useState(sessionFromParams);
  const [loadingSession, setLoadingSession] = useState(!sessionFromParams);

  const [job, setJob] = useState(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [saving, setSaving] = useState(false);

  // Session nachladen (falls keiner mitgegeben)
  useEffect(() => {
    if (!session) {
      (async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session) setSession(data.session);
        setLoadingSession(false);
      })();
    }
  }, [session]);

  // kleine Helper, weil du manchmal Arrays, manchmal Strings bekommst
  const parseMaybeArray = (value) => {
    if (!value && value !== 0) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      // versuchen zu parsen
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        // kein Array → einzelner Wert
        return [parsed];
      } catch (e) {
        // war nur ein normaler String
        return [value];
      }
    }
    return [String(value)];
  };

  // Job laden
  useEffect(() => {
    if (!jobId || !session?.user?.id) return;
    (async () => {
      setLoadingJob(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('employer_id', session.user.id)
        .maybeSingle(); // ← KEIN .single(), damit dein "multiple/no rows" nicht kommt

      if (error) {
        console.error(error);
        Alert.alert(
          i18n.t('jobDetail.errorTitle', { defaultValue: 'Fehler' }),
          i18n.t('jobDetail.errorLoadText', {
            defaultValue: 'Stellenanzeige konnte nicht geladen werden.',
          })
        );
      } else {
        setJob(data);
      }
      setLoadingJob(false);
    })();
  }, [jobId, session?.user?.id]);

  const createdText = useMemo(() => {
    if (!job?.created_at) return '';
    const d = new Date(job.created_at);
    return d.toLocaleDateString([], {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, [job?.created_at]);

  const toggleActive = async () => {
    if (!job) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('jobs')
        .update({ is_active: !job.is_active })
        .eq('id', job.id)
        .eq('employer_id', session.user.id);
      if (error) throw error;
      setJob((j) => ({ ...j, is_active: !j.is_active }));
    } catch (e) {
      console.error(e);
      Alert.alert(
        i18n.t('jobDetail.errorChangeStatusTitle', { defaultValue: 'Fehler' }),
        i18n.t('jobDetail.errorChangeStatusText', {
          defaultValue: 'Status konnte nicht geändert werden.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteJob = () => {
    if (!job) return;
    Alert.alert(
      i18n.t('jobDetail.deleteTitle', { defaultValue: 'Anzeige löschen' }),
      i18n.t('jobDetail.deleteQuestion', {
        defaultValue: 'Möchtest du diese Stellenanzeige wirklich löschen?',
      }),
      [
        {
          text: i18n.t('jobDetail.cancel', { defaultValue: 'Abbrechen' }),
          style: 'cancel',
        },
        {
          text: i18n.t('jobDetail.yesDelete', { defaultValue: 'Löschen' }),
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              // WICHTIG: kein .single() hier!
              const { error } = await supabase
                .from('jobs')
                .delete()
                .eq('id', job.id)
                .eq('employer_id', session.user.id);

              if (error) throw error;

              // nach erfolgreichem Löschen direkt zurück zur Liste
              // und Liste zwingen, neu zu laden
              navigation.replace('EmployerJobs', {
                session,
                forceReload: Date.now(),
              });
            } catch (e) {
              console.error(e);
              Alert.alert(
                i18n.t('jobDetail.deleteErrorTitle', { defaultValue: 'Fehler' }),
                i18n.t('jobDetail.deleteErrorText', {
                  defaultValue: 'Löschen fehlgeschlagen.',
                })
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const goEdit = () => {
    if (!job) return;
    navigation.navigate('JobEditorScreen', { jobId: job.id, session });
  };

  const goMatchWithCandidates = () => {
    if (!job) return;
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

  if (loadingSession || loadingJob) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ marginTop: 8, color: '#666' }}>
          {i18n.t('jobDetail.loading', { defaultValue: 'Lade Daten…' })}
        </Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#666' }}>
          {i18n.t('jobDetail.notFound', {
            defaultValue: 'Stellenanzeige nicht gefunden.',
          })}
        </Text>
      </View>
    );
  }

  // m/w/d wieder anzeigen
  const genderSuffix = Array.isArray(job.gender_tags)
    ? job.gender_tags.join('/')
    : job.gender_tags
    ? String(job.gender_tags)
    : 'm/w/d';

  const employmentForms = parseMaybeArray(job.employment_form);
  const employmentTypes = parseMaybeArray(job.employment_type);
  const languages = parseMaybeArray(job.language);

  const salaryText =
    job.salary_min || job.salary_max
      ? `${job.salary_min ? `${job.salary_min}€` : ''}${
          job.salary_min && job.salary_max ? ' - ' : ''
        }${job.salary_max ? `${job.salary_max}€` : ''}`
      : null;

  const yesText = i18n.t('jobDetail.yes', { defaultValue: 'Ja' });
  const noText = i18n.t('jobDetail.no', { defaultValue: 'Nein' });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {i18n.t('jobDetail.title', { defaultValue: 'Stellenanzeige' })}
        </Text>
        <TouchableOpacity onPress={goEdit}>
          <Ionicons name="create-outline" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Titel & Status */}
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {job.title || i18n.t('jobDetail.noTitle', { defaultValue: 'Stellenanzeige' })}{' '}
              {/* m/w/d direkt dran */}
              <Text style={styles.mwd}>({genderSuffix})</Text>
            </Text>
            {createdText ? (
              <Text style={styles.meta}>
                {i18n.t('jobDetail.createdAtPrefix', { defaultValue: 'Erstellt am' })}{' '}
                {createdText}
              </Text>
            ) : null}
            {job.location_city ? (
              <Text style={styles.meta}>
                {i18n.t('jobDetail.location', { defaultValue: 'Standort' })}:{' '}
                {job.location_city}
              </Text>
            ) : null}
          </View>

          <View
            style={[
              styles.statusBadge,
              job.is_active ? styles.statusOn : styles.statusOff,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                job.is_active ? styles.statusTextOn : styles.statusTextOff,
              ]}
            >
              {job.is_active
                ? i18n.t('jobDetail.statusOnline', { defaultValue: 'Online' })
                : i18n.t('jobDetail.statusOffline', { defaultValue: 'Offline' })}
            </Text>
          </View>
        </View>

        {/* Rahmendaten */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {i18n.t('jobDetail.sectionBasics', { defaultValue: 'Rahmendaten' })}
          </Text>

          {/* Beschäftigungsform */}
          {employmentForms.length > 0 && (
            <View style={styles.lineRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="briefcase-outline" size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {i18n.t('jobDetail.employmentForm', {
                    defaultValue: 'Beschäftigungsform',
                  })}
                </Text>
                <View style={styles.chipRow}>
                  {employmentForms.map((f, idx) => (
                    <View key={idx} style={styles.chip}>
                      <Text style={styles.chipText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Beschäftigungstyp */}
          {employmentTypes.length > 0 && (
            <View style={styles.lineRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="time-outline" size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {i18n.t('jobDetail.employmentType', {
                    defaultValue: 'Beschäftigungstyp',
                  })}
                </Text>
                <View style={styles.chipRow}>
                  {employmentTypes.map((f, idx) => (
                    <View key={idx} style={styles.chip}>
                      <Text style={styles.chipText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Sprachen */}
          {languages.length > 0 && (
            <View style={styles.lineRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="language-outline" size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {i18n.t('jobDetail.language', { defaultValue: 'Sprache' })}
                </Text>
                <View style={styles.chipRow}>
                  {languages.map((lang, idx) => (
                    <View key={idx} style={styles.chip}>
                      <Text style={styles.chipText}>{lang}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Branche */}
          {job.industry ? (
            <View style={styles.lineRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="business-outline" size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {i18n.t('jobDetail.industry', { defaultValue: 'Branche' })}
                </Text>
                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{job.industry}</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* Vergütung */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {i18n.t('jobDetail.sectionComp', {
              defaultValue: 'Vergütung & Extras',
            })}
          </Text>

          {/* Gehalt */}
          <View style={styles.lineRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="cash-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {i18n.t('jobDetail.salary', { defaultValue: 'Gehalt' })}
              </Text>
              <Text style={styles.value}>{salaryText || '—'}</Text>
            </View>
          </View>

          {/* Weihnachtsgeld */}
          <View style={styles.lineRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="gift-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {i18n.t('jobDetail.christmasBonus', {
                  defaultValue: 'Weihnachtsgeld',
                })}
              </Text>
              <Text style={styles.value}>
                {job.christmas_bonus ? yesText : noText}
              </Text>
            </View>
          </View>

          {/* Urlaubsgeld */}
          <View style={styles.lineRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="sunny-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {i18n.t('jobDetail.holidayBonus', {
                  defaultValue: 'Urlaubsgeld',
                })}
              </Text>
              <Text style={styles.value}>
                {job.holiday_bonus ? yesText : noText}
              </Text>
            </View>
          </View>

          {/* Sofort verfügbar */}
          <View style={styles.lineRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="flash-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {i18n.t('jobDetail.availableNow', {
                  defaultValue: 'Sofort verfügbar',
                })}
              </Text>
              <Text style={styles.value}>
                {job.available_now ? yesText : noText}
              </Text>
            </View>
          </View>
        </View>

        {/* Beschreibung */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {i18n.t('jobDetail.description', { defaultValue: 'Beschreibung' })}
          </Text>
          <Text style={styles.desc}>{job.description || '—'}</Text>
        </View>

        {/* Aktionen */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
            onPress={toggleActive}
            disabled={saving}
          >
            <Ionicons
              name={job.is_active ? 'pause-outline' : 'play-outline'}
              size={18}
              color="#fff"
            />
            <Text style={styles.primaryBtnText}>
              {job.is_active
                ? i18n.t('jobDetail.btnPause', {
                    defaultValue: 'Anzeige pausieren',
                  })
                : i18n.t('jobDetail.btnActivate', {
                    defaultValue: 'Anzeige aktivieren',
                  })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={goEdit}>
            <Ionicons name="create-outline" size={18} color={C.primary} />
            <Text style={styles.secondaryBtnText}>
              {i18n.t('jobDetail.btnEdit', { defaultValue: 'Bearbeiten' })}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.matchBtn}
          onPress={goMatchWithCandidates}
        >
          <Ionicons name="people-outline" size={18} color="#fff" />
          <Text style={styles.matchBtnText}>
            {i18n.t('jobDetail.btnMatch', {
              defaultValue: 'Mit Kandidaten matchen',
            })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={deleteJob}>
          <Ionicons name="trash-outline" size={18} color={C.danger} />
          <Text style={styles.deleteBtnText}>
            {i18n.t('jobDetail.btnDelete', {
              defaultValue: 'Anzeige löschen',
            })}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: C.white,
    borderBottomColor: C.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.primary },

  cardTop: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  title: { fontSize: 18, fontWeight: '700', color: C.dark },
  mwd: { fontSize: 14, color: C.sub },
  meta: { marginTop: 4, color: C.sub, fontSize: 12 },

  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusOn: { backgroundColor: '#e6f6ec' },
  statusOff: { backgroundColor: '#f3f4f6' },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusTextOn: { color: '#2e7d32' },
  statusTextOff: { color: '#6b7280' },

  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.dark, marginBottom: 12 },

  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#e6f2fb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  label: { fontSize: 13, color: C.sub, marginBottom: 4 },
  value: { fontSize: 14, color: C.dark },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: '#e6f2fb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: { color: '#0f172a', fontSize: 13 },

  desc: { fontSize: 14, color: C.dark, lineHeight: 20 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6 },

  secondaryBtn: {
    backgroundColor: '#e6f2fb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: C.primary, fontWeight: '700', marginLeft: 6 },

  matchBtn: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  matchBtnText: { color: '#fff', fontWeight: '700', marginLeft: 8 },

  deleteBtn: {
    marginTop: 12,
    backgroundColor: C.dangerBg,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteBtnText: { color: C.danger, fontWeight: '700', marginLeft: 6 },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
