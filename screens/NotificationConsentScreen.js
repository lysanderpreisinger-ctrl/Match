// screens/NotificationConsentScreen.js
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Linking,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../supabaseClient';

const APP_BLUE = '#4db3f4';

// Optional: Basis-Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function NotificationConsentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const role = route.params?.role;
  const session = route.params?.session || null; // ⬅️ neu: session mitnehmen

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [isAdult, setIsAdult] = useState(false); // Mindestalter

  const canProceed = useMemo(
    () => acceptTerms && acceptPrivacy && isAdult,
    [acceptTerms, acceptPrivacy, isAdult]
  );

  // ⬇️ Token holen + in Supabase speichern
  const registerForPush = async () => {
    try {
      // 1. Berechtigungen
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Hinweis', 'Push-Benachrichtigungen wurden nicht erlaubt.');
        return null;
      }

      // 2. Token holen
      const tokenData = await Notifications.getExpoPushTokenAsync({
        // projectId kann leer bleiben, wenn dein app.json/app.config passt
      });
      const token = tokenData.data;

      // 3. Android-Channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }

      // 4. in Supabase speichern
      if (session?.user?.id && token) {
        await supabase
          .from('profiles')
          .update({
            expo_push_token: token,
            notif_new_messages: true,
            notif_new_matches: true,
            notif_flexjobs: true,
            notif_jobposts: true,
          })
          .eq('id', session.user.id);
      }

      return token;
    } catch (e) {
      console.log('Push-Registrierung fehlgeschlagen:', e);
      return null;
    }
  };

  const handleNext = async () => {
    if (!canProceed) return;

    if (pushEnabled) {
      // User will Push → registrieren
      await registerForPush();
    } else {
      // User will KEIN Push → Flags aus + Token weg
      if (session?.user?.id) {
        await supabase
          .from('profiles')
          .update({
            expo_push_token: null,
            notif_new_messages: false,
            notif_new_matches: false,
            notif_flexjobs: false,
            notif_jobposts: false,
          })
          .eq('id', session.user.id);
      }
    }

    navigation.navigate('ProfileDetailsScreen', {
      role,
      pushEnabled,
      emailEnabled,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Zurück"
        >
          <Ionicons name="arrow-back" size={24} color={APP_BLUE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Benachrichtigungen</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Inhalt zentriert */}
      <View style={styles.content}>
        {/* Icon + Titel */}
        <View style={styles.card}>
          <Ionicons
            name="notifications-outline"
            size={40}
            color={APP_BLUE}
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.title}>Verpasse keine Nachrichten mehr!</Text>
          <Text style={styles.subtitle}>
            Lass dich über neue Matches und Jobs, die zu deiner Suche passen,
            automatisch informieren.
          </Text>
        </View>

        {/* Switch-Optionen */}
        <View style={styles.option}>
          <Text style={styles.optionLabel}>Push-Nachrichten</Text>
          <Switch
            trackColor={{ false: '#ccc', true: APP_BLUE }}
            thumbColor="#fff"
            onValueChange={setPushEnabled}
            value={pushEnabled}
          />
        </View>

        <View style={styles.option}>
          <Text style={styles.optionLabel}>E-Mail-Adresse</Text>
          <Switch
            trackColor={{ false: '#ccc', true: APP_BLUE }}
            thumbColor="#fff"
            onValueChange={setEmailEnabled}
            value={emailEnabled}
          />
        </View>

        {/* Zustimmungen (Checkboxen) */}
        <CheckboxRow
          checked={acceptTerms}
          onToggle={() => setAcceptTerms(v => !v)}
          label={
            <>Ich akzeptiere die{' '}
              <Text style={styles.link} onPress={() => Linking.openURL('https://deine-url.com/nutzungsbedingungen')}>
                AGB
              </Text>.
            </>
          }
        />
        <CheckboxRow
          checked={acceptPrivacy}
          onToggle={() => setAcceptPrivacy(v => !v)}
          label={
            <>Ich habe die{' '}
              <Text style={styles.link} onPress={() => Linking.openURL('https://deine-url.com/datenschutz')}>
                Datenschutzerklärung
              </Text>{' '}
              gelesen.
            </>
          }
        />
        <CheckboxRow
          checked={isAdult}
          onToggle={() => setIsAdult(v => !v)}
          label={<>Ich bin mindestens 16 Jahre alt.</>}
        />

        {/* Footer + Button */}
        <View style={styles.footerBlock}>
          <Text style={styles.footerText}>
            Du kannst dich jederzeit von den Jatch Newslettern und Services
            abmelden. Details findest du in unseren AGB und der Datenschutzerklärung.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, !canProceed && { opacity: 0.6 }]}
            onPress={handleNext}
            disabled={!canProceed}
          >
            <Text style={styles.primaryButtonText}>Nächster Schritt</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function CheckboxRow({ checked, onToggle, label }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={styles.checkboxRow}>
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },

  header: {
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: APP_BLUE },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  card: {
    borderWidth: 1,
    borderColor: APP_BLUE,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center' },

  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  optionLabel: { fontSize: 16 },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  checkboxBoxChecked: {
    backgroundColor: APP_BLUE,
    borderColor: APP_BLUE,
  },
  checkboxLabel: { flex: 1, color: '#333' },

  footerBlock: { marginTop: 20 },
  footerText: { fontSize: 12, color: '#666', lineHeight: 16, marginBottom: 16 },
  link: { color: APP_BLUE },

  primaryButton: {
    backgroundColor: APP_BLUE,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
