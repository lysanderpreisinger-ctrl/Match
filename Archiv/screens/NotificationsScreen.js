// screens/NotificationsScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../supabaseClient';
import { useLang } from '../LanguageContext';

const C = {
  bg: '#f7f8fb',
  white: '#fff',
  primary: '#4db3f4',
  text: '#0f172a',
  sub: '#64748b',
  line: '#e5e7eb',
};

export default function NotificationsScreen({ navigation, route }) {
  // 1) zuerst versuchen aus params
  const [session, setSession] = useState(route?.params?.session || null);
  const { t } = useLang();

  const [loading, setLoading] = useState(false);

  const [newMessages, setNewMessages] = useState(true);
  const [newMatches, setNewMatches] = useState(true);
  const [newFlexJobs, setNewFlexJobs] = useState(true);
  const [newJobposts, setNewJobposts] = useState(true);

  // 2) falls nichts in params steckt → aus supabase nachladen
  useEffect(() => {
    (async () => {
      if (session?.user?.id) return; // wir haben schon was
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session) {
        setSession(data.session);
      }
    })();
  }, [session?.user?.id]);

  // 3) beim Öffnen Settings aus DB holen
  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'notif_new_messages, notif_new_matches, notif_flexjobs, notif_jobposts'
        )
        .eq('id', session.user.id)
        .maybeSingle();

      if (!error && data) {
        if (typeof data.notif_new_messages === 'boolean')
          setNewMessages(data.notif_new_messages);
        if (typeof data.notif_new_matches === 'boolean')
          setNewMatches(data.notif_new_matches);
        if (typeof data.notif_flexjobs === 'boolean')
          setNewFlexJobs(data.notif_flexjobs);
        if (typeof data.notif_jobposts === 'boolean')
          setNewJobposts(data.notif_jobposts);
      }
    })();
  }, [session?.user?.id]);

  async function handleSave() {
    // <- hier war dein "Kein Benutzer gefunden"
    if (!session?.user?.id) {
      Alert.alert('Oops', 'Kein Benutzer gefunden.');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        notif_new_messages: newMessages,
        notif_new_matches: newMatches,
        notif_flexjobs: newFlexJobs,
        notif_jobposts: newJobposts,
      })
      .eq('id', session.user.id);
    setLoading(false);

    if (error) {
      Alert.alert(
        t('common.error') || 'Fehler',
        error.message || t('common.retry') || 'Erneut versuchen'
      );
      return;
    }

    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('settings.notifications') || 'Benachrichtigungen'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Liste */}
      <View style={styles.list}>
        <NotifRow
          title={t('notifications.newMessages') || 'Neue Nachrichten'}
          subtitle={t('notifications.newMessagesSub') || 'Wenn dir jemand schreibt'}
          value={newMessages}
          onValueChange={setNewMessages}
        />

        <Divider />

        <NotifRow
          title={t('notifications.newMatches') || 'Neue Matches'}
          subtitle={t('notifications.newMatchesSub') || 'Wenn ein neues jatch entsteht'}
          value={newMatches}
          onValueChange={setNewMatches}
        />

        <Divider />

        <NotifRow
          title={t('notifications.newFlexJobs') || 'Neue FlexJobs'}
          subtitle={t('notifications.newFlexJobsSub') || 'Spontane Jobs in deiner Nähe'}
          value={newFlexJobs}
          onValueChange={setNewFlexJobs}
        />

        <Divider />

        <NotifRow
          title={t('notifications.newJobposts') || 'Neue Stellenanzeigen'}
          subtitle={t('notifications.newJobpostsSub') || 'Reguläre / längere Jobs'}
          value={newJobposts}
          onValueChange={setNewJobposts}
        />
      </View>

      {/* Button unten */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveText}>
            {t('common.applyChanges') || 'Änderungen übernehmen'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function NotifRow({ title, subtitle, value, onValueChange }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.white,
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.primary },
  list: {
    backgroundColor: C.white,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowTitle: { fontSize: 15, color: C.text, fontWeight: '500' },
  rowSub: { fontSize: 12, color: C.sub, marginTop: 2, maxWidth: '85%' },
  divider: { height: 1, backgroundColor: C.line, marginLeft: 16 },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: C.bg,
  },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
