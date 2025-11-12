// screens/RegisterCredentialsScreen.js
import React, { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../supabaseClient';

const APP_BLUE = '#4db3f4';

export default function RegisterCredentialsScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Optional aus vorherigen Schritten
  const roleFromParams = route.params?.role ?? null;
  const pushEnabled = route.params?.pushEnabled ?? null;
  const emailEnabled = route.params?.emailEnabled ?? null;

  const roleDefault = (roleFromParams || 'employee').toLowerCase();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);

  // Anforderungen
  const hasMinLen = pw.length >= 8;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);

  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const pwMatch = pw.length > 0 && pw === pw2;
  const pwValid = hasMinLen && hasLetter && hasNumber;

  const pwScore = (hasMinLen ? 1 : 0) + (hasLetter ? 1 : 0) + (hasNumber ? 1 : 0);
  const strengthLabel =
    pwScore === 0 ? 'Sehr schwach' : pwScore === 1 ? 'Schwach' : pwScore === 2 ? 'Okay' : 'Stark';
  const barColor =
    pwScore === 0 ? '#e74c3c' : pwScore === 1 ? '#e67e22' : pwScore === 2 ? '#f1c40f' : '#2ecc71';

  const canSubmit = emailValid && pwValid && pwMatch && !loading;

  const submit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      // 1) Account anlegen
      const { data, error } = await supabase.auth.signUp({ email, password: pw });
      if (error) throw error;

      // 2) Profile upserten (falls User vorhanden)
      const userId = data?.user?.id || null;
      if (userId) {
        const payload = {
          id: userId,
          email,
          role: roleDefault,
          push_enabled: pushEnabled,
          email_enabled: emailEnabled,
        };
        Object.keys(payload).forEach((k) => payload[k] == null && delete payload[k]);

        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert(payload, { onConflict: 'id' });

        if (upsertErr) {
          // nicht blockieren, nur loggen
          console.log('profiles upsert hint:', upsertErr?.message);
        }
      }

      // 3) Aktive Session bestimmen (supabase.signUp kann je nach E-Mail-Flow null zurückgeben)
      let activeSession = data?.session ?? null;
      if (!activeSession) {
        const { data: sessData } = await supabase.auth.getSession();
        activeSession = sessData?.session ?? null;
      }

      // 4) Navigation: auf Root „Main“ resetten (Tabs), inkl. Rolle & Session
      if (activeSession) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main', params: { session: activeSession, role: roleDefault } }],
        });
      } else {
        // Kein aktives Login (z. B. weil E-Mail-Bestätigung nötig ist)
        Alert.alert(
          'E-Mail bestätigen',
          'Wir haben dir eine Bestätigungs-E-Mail gesendet. Bitte bestätige deine E-Mail und melde dich anschließend an.'
        );
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    } catch (e) {
      Alert.alert('Fehler bei der Registrierung', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Zurück">
          <Ionicons name="arrow-back" size={24} color={APP_BLUE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrieren</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Inhalt */}
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Konto erstellen</Text>
          <Text style={styles.subtitle}>Lege deine Zugangsdaten fest.</Text>

          <Text style={styles.sectionHeading}>E-Mail</Text>
          <TextInput
            style={styles.input}
            placeholder="E-Mail-Adresse"
            placeholderTextColor="#8ea0ad"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {!emailValid && email.length > 0 && (
            <Text style={styles.hint}>Bitte gib eine gültige E-Mail an.</Text>
          )}

          <Text style={[styles.sectionHeading, { marginTop: 10 }]}>Passwort</Text>
          <TextInput
            style={styles.input}
            placeholder="Passwort (min. 8 Zeichen, Zahl + Buchstabe)"
            placeholderTextColor="#8ea0ad"
            secureTextEntry
            value={pw}
            onChangeText={setPw}
          />

          {/* Stärkebalken */}
          <View style={styles.strengthBarWrapper}>
            <View style={[styles.strengthBarFill, { width: `${(pwScore / 3) * 100}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={styles.strengthLabel}>{strengthLabel}</Text>

          <ReqRow ok={hasMinLen} text="Mindestens 8 Zeichen" />
          <ReqRow ok={hasLetter} text="Mindestens 1 Buchstabe (A–Z)" />
          <ReqRow ok={hasNumber} text="Mindestens 1 Zahl (0–9)" />

          <TextInput
            style={styles.input}
            placeholder="Passwort bestätigen"
            placeholderTextColor="#8ea0ad"
            secureTextEntry
            value={pw2}
            onChangeText={setPw2}
          />
          {pw.length > 0 && pw2.length > 0 && !pwMatch && (
            <Text style={styles.hint}>Passwörter stimmen nicht überein.</Text>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, !canSubmit && { opacity: 0.6 }]}
            disabled={!canSubmit}
            onPress={submit}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Wird erstellt…' : 'Konto erstellen'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.smallNote}>
            Du erhältst eine E-Mail zur Bestätigung. Danach geht’s weiter.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ReqRow({ ok, text }) {
  return (
    <View style={styles.reqRow}>
      <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={16} color={ok ? '#2ecc71' : '#e74c3c'} />
      <Text style={[styles.reqText, ok && { color: '#2ecc71' }]}>{text}</Text>
    </View>
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
    paddingHorizontal: 16,
  },

  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  title: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 12 },

  sectionHeading: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 6 },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    marginBottom: 12,
  },

  hint: { color: '#c0392b', fontSize: 12, marginBottom: 8 },

  strengthBarWrapper: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 6,
  },
  strengthBarFill: { height: '100%', borderRadius: 999 },
  strengthLabel: { fontSize: 12, color: '#666', marginBottom: 8 },

  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reqText: { fontSize: 12, color: '#666' },

  primaryButton: {
    backgroundColor: APP_BLUE,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  smallNote: { fontSize: 12, color: '#777', textAlign: 'center', marginTop: 10 },
});
