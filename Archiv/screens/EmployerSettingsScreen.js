// screens/EmployerSettingsScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../supabaseClient';
import { useLang } from '../LanguageContext';
import i18n from '../i18n';

const COLOR = {
  bg: '#fff',
  line: '#e5e7eb',
  text: '#111',
  sub: '#6b7280',
  primary: '#4db3f4',
  danger: '#ef4444',
};

export default function EmployerSettingsScreen({ navigation, route }) {
  const session = route?.params?.session || null;
  const role = route?.params?.role || 'employer';
  const [appLanguage, setAppLanguage] = useState('de');
  const { t } = useLang();

  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('app_language')
        .eq('id', session.user.id)
        .maybeSingle();
      if (data?.app_language) setAppLanguage(data.app_language);
    })();
  }, [session?.user?.id]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }

  async function handleDeleteAccount() {
    Alert.alert(
      t('settings.deleteConfirmTitle') || 'Account löschen',
      t('settings.deleteConfirmText') ||
        'Bist du sicher? Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: t('settings.deleteConfirmCancel') || 'Abbrechen', style: 'cancel' },
        {
          text: t('settings.deleteConfirmOk') || 'Löschen',
          style: 'destructive',
          onPress: async () => {
            if (session?.user?.id) {
              await supabase.from('profiles').delete().eq('id', session.user.id);
              await supabase.auth.signOut();
            }
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]
    );
  }

  // 💳 Payment: Hinweis für Arbeitnehmer
  function handlePaymentPress() {
    if (role !== 'employer') {
      Alert.alert(
        t('settings.payment') || 'Bezahlmethode',
        t('settings.paymentComingSoon') ||
          'Diese Funktion ist evtl. in der Zukunft verfügbar.'
      );
      return;
    }
    navigation.navigate('PaymentMethodsScreen', { session, role });
  }

  // 🌍 Sprachwert (zeigt "Deutsch" oder "English" je nach i18n.locale)
  const currentLocale = i18n.locale.startsWith('en')
    ? t('settings.languageEnglish') || 'English'
    : t('settings.languageGerman') || 'Deutsch';

  return (
    <SafeAreaView style={styles.screen}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('settings.title') || 'Einstellungen'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* LISTE */}
      <View style={styles.list}>
        <SettingsRow
          icon="chatbubble-ellipses-outline"
          title={t('settings.feedback') || 'Feedback'}
          onPress={() => navigation.navigate('FeedbackScreen', { session, role })}
        />
        <Divider />

        <SettingsRow
          icon="share-social-outline"
          title={t('settings.share') || 'App teilen'}
          onPress={() => {}}
        />
        <Divider />

        <SettingsRow
          icon="star-outline"
          title={t('settings.rate') || 'App bewerten'}
          onPress={() => {}}
        />
        <Divider />

        <SettingsRow
          icon="document-text-outline"
          title={t('settings.imprint') || 'Impressum'}
          onPress={() => {}}
        />
        <Divider />

        <SettingsRow
          icon="shield-checkmark-outline"
          title={t('settings.privacy') || 'Datenschutzerklärung'}
          onPress={() => {}}
        />
        <Divider />

        <SettingsRow
          icon="reader-outline"
          title={t('settings.terms') || 'AGB'}
          onPress={() => {}}
        />
        <Divider />

        <SettingsRow
          icon="notifications-outline"
          title={t('settings.notifications') || 'Benachrichtigungen'}
          onPress={() => navigation.navigate('NotificationsScreen', { session, role })}
        />
        <Divider />

        <SettingsRow
          icon="language-outline"
          title={t('settings.language') || 'Sprache'}
          value={currentLocale}
          onPress={() =>
            navigation.navigate('LanguageScreen', {
              session,
              currentLang: appLanguage,
              role,
            })
          }
        />
        <Divider />

        <SettingsRow
          icon="card-outline"
          title={t('settings.payment') || 'Bezahlmethode'}
          onPress={handlePaymentPress}
        />
        <Divider />

        <SettingsRow
          icon="exit-outline"
          title={t('settings.signout') || 'Abmelden'}
          danger
          onPress={handleSignOut}
        />
        <Divider />

        <SettingsRow
          icon="trash-outline"
          title={t('settings.delete') || 'Account löschen'}
          danger
          onPress={handleDeleteAccount}
        />
      </View>
    </SafeAreaView>
  );
}

function SettingsRow({ icon, title, subtitle, value, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.left}>
        {icon && (
          <Ionicons
            name={icon}
            size={22}
            color={danger ? COLOR.danger : COLOR.primary}
            style={{ width: 26 }}
          />
        )}
        <View style={{ flexDirection: 'column' }}>
          <Text style={[styles.title, danger && { color: COLOR.danger }]}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>

      <View style={styles.right}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        <Ionicons
          name="chevron-forward"
          size={20}
          color={danger ? COLOR.danger : '#cbd5e1'}
        />
      </View>
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  list: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  title: {
    fontSize: 16,
    color: COLOR.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLOR.sub,
    marginTop: 2,
  },
  value: {
    fontSize: 13,
    color: COLOR.sub,
    marginRight: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 58,
  },
});
