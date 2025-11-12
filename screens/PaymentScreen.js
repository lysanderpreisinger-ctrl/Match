// screens/PaymentScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { supabase } from '../supabaseClient';

// --------- STRIPE PRICE IDs (one-time) ---------
const PRICE_BASIC_MATCH_29 = 'price_1Rwh5aBh0hSWnazMQj0avqVI'; // Basic: 29 €
const PRICE_STANDARD_EXTRA_MATCH_9_99 = 'price_1RwhAtBh0hSWnazMc8R3cZcW'; // Standard: >10tes Match im Monat 9,99 €
const PRICE_STANDARD_FLEXJOB_1_99 = 'price_1SNiQEBh0hSWnazMDch6eWuj'; // Standard: Flex-Job 1,99 €

// URLs für Stripe-Redirects
const SUCCESS_URL = 'https://example.com/checkout-success';
const CANCEL_URL = 'https://example.com/checkout-cancel';

export default function PaymentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { matchId, plan = 'basic', employee, isFlexJob = false } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pendingSetupSessionId, setPendingSetupSessionId] = useState(null);
  const lastPriceIdRef = useRef(null);

  // Profil laden (Stripe-Kundendaten abrufen)
  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('stripe_customer_id, stripe_payment_method_id')
        .eq('id', userId)
        .maybeSingle();
      setProfile(prof || {});
    })();
  }, []);

  // Zähle freigeschaltete Matches im aktuellen Monat
  const countUnlockedMatchesThisMonth = useCallback(async (employerId) => {
    const now = new Date();
    const firstDayIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('employer_id', employerId)
      .eq('employer_unlocked', true)
      .gte('created_at', firstDayIso);
    return count || 0;
  }, []);

  // Match freischalten & Zahlung loggen
  const unlockAndLog = useCallback(async ({ matchId, amountCents, status }) => {
    await supabase
      .from('matches')
      .update({
        employer_unlocked: true,
        employer_unlocked_at: new Date().toISOString(),
        employer_payment_status: status,
      })
      .eq('id', matchId);
    await supabase.from('match_payments').insert({
      match_id: matchId,
      amount: (amountCents ?? 0) / 100,
      status,
    });
  }, []);

  // Stripe Checkout starten
  const startCheckout = useCallback(async (priceId, mode = 'payment', extraBody = {}) => {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { priceId, successUrl: SUCCESS_URL, cancelUrl: CANCEL_URL, mode, ...extraBody },
    });
    if (error) throw new Error(error.message || 'Checkout-Session fehlgeschlagen');
    if (!data?.url) throw new Error('Keine Checkout-URL erhalten');
    return data;
  }, []);

  // WebView-Navigation überwachen (Erfolg/Abbruch)
  const onNavChange = useCallback(
    async (navState) => {
      const url = navState?.url || '';
      if (!url) return;

      // --- Setup abgeschlossen (Karte gespeichert) ---
      if (pendingSetupSessionId && url.startsWith(SUCCESS_URL)) {
        try {
          const { data, error } = await supabase.functions.invoke('get-checkout-session', {
            body: { sessionId: pendingSetupSessionId },
          });
          if (error) throw new Error(error.message);
          const { customerId, paymentMethodId } = data;
          if (!customerId || !paymentMethodId)
            throw new Error('Karte konnte nicht gespeichert werden.');

          // Im Profil speichern
          const { data: userRes } = await supabase.auth.getUser();
          const userId = userRes?.user?.id;
          await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              stripe_payment_method_id: paymentMethodId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          // WebView schließen
          setCheckoutUrl(null);
          setPendingSetupSessionId(null);

          // Abbuchung 29 € für Basic durchführen
          const { error: chargeErr } = await supabase.functions.invoke('charge-saved-method', {
            body: {
              customerId,
              paymentMethodId,
              amountCents: 2900,
              metadata: { user_id: userId, type: 'basic_match_after_setup' },
            },
          });
          if (chargeErr) throw new Error(chargeErr.message);

          await unlockAndLog({ matchId, amountCents: 2900, status: 'paid' });
          Alert.alert('Erfolg', 'Match freigeschaltet.');
          navigation.goBack();
          return;
        } catch (e) {
          Alert.alert('Fehler', e.message);
          setCheckoutUrl(null);
          setPendingSetupSessionId(null);
        }
      }

      // --- Normaler Checkout erfolgreich ---
      if (url.startsWith(SUCCESS_URL)) {
        try {
          const cents =
            lastPriceIdRef.current === PRICE_BASIC_MATCH_29
              ? 2900
              : lastPriceIdRef.current === PRICE_STANDARD_EXTRA_MATCH_9_99
              ? 999
              : lastPriceIdRef.current === PRICE_STANDARD_FLEXJOB_1_99
              ? 199
              : 0;
          await unlockAndLog({ matchId, amountCents: cents, status: 'paid' });
          Alert.alert('Erfolg', 'Freigeschaltet.');
          setCheckoutUrl(null);
          navigation.goBack();
        } catch (e) {
          Alert.alert('Fehler', e.message);
          setCheckoutUrl(null);
          navigation.goBack();
        }
      }

      // --- Checkout abgebrochen ---
      if (url.startsWith(CANCEL_URL)) {
        setCheckoutUrl(null);
        setPendingSetupSessionId(null);
      }
    },
    [pendingSetupSessionId, matchId, navigation, unlockAndLog]
  );

  // Hauptlogik beim Klick
  const handlePay = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) throw new Error('Kein eingeloggter Nutzer.');

      // Premium → immer inklusive
      if (plan === 'premium') {
        await unlockAndLog({ matchId, amountCents: 0, status: 'included' });
        Alert.alert('Freigeschaltet', 'In Premium inklusive.');
        navigation.goBack();
        return;
      }

      // Basic: Flex-Jobs nicht erlaubt
      if (plan === 'basic' && isFlexJob) {
        Alert.alert('Upgrade nötig', 'Flex-Jobs sind im Basic-Plan nicht verfügbar.');
        return;
      }

      // Standard + Flex-Job → 1,99 €
      if (plan === 'standard' && isFlexJob) {
        lastPriceIdRef.current = PRICE_STANDARD_FLEXJOB_1_99;
        const { url } = await startCheckout(PRICE_STANDARD_FLEXJOB_1_99);
        setCheckoutUrl(url);
        return;
      }

      // Standard → 10 inklusive, dann 9,99 €
      if (plan === 'standard') {
        const used = await countUnlockedMatchesThisMonth(userId);
        if (used < 10) {
          await unlockAndLog({ matchId, amountCents: 0, status: 'included' });
          Alert.alert('Freigeschaltet', 'Dieses Match zählt zu deinen 10 inklusiven Matches.');
          navigation.goBack();
          return;
        }
        lastPriceIdRef.current = PRICE_STANDARD_EXTRA_MATCH_9_99;
        const { url } = await startCheckout(PRICE_STANDARD_EXTRA_MATCH_9_99);
        setCheckoutUrl(url);
        return;
      }

      // Basic → prüfen, ob Karte schon vorhanden
      const hasCard = profile?.stripe_customer_id && profile?.stripe_payment_method_id;
      if (!hasCard) {
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body: {
            mode: 'setup',
            successUrl: SUCCESS_URL,
            cancelUrl: CANCEL_URL,
            customerEmail: userRes.user.email,
            metadata: { user_id: userId, reason: 'save_card_for_basic' },
          },
        });
        if (error) throw new Error(error.message);
        setPendingSetupSessionId(data.id);
        setCheckoutUrl(data.url);
        return;
      }

      // Karte vorhanden → direkt abbuchen
      const { error: chargeErr } = await supabase.functions.invoke('charge-saved-method', {
        body: {
          customerId: profile.stripe_customer_id,
          paymentMethodId: profile.stripe_payment_method_id,
          amountCents: 2900,
          metadata: { user_id: userId, type: 'basic_match' },
        },
      });
      if (chargeErr) throw new Error(chargeErr.message);

      await unlockAndLog({ matchId, amountCents: 2900, status: 'paid' });
      Alert.alert('Erfolg', 'Match freigeschaltet.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoading(false);
    }
  }, [plan, isFlexJob, matchId, navigation, profile, countUnlockedMatchesThisMonth, startCheckout, unlockAndLog]);

  // WebView anzeigen
  if (checkoutUrl) {
    return <WebView source={{ uri: checkoutUrl }} style={{ flex: 1 }} onNavigationStateChange={onNavChange} />;
  }

  return (
    <View style={styles.container}>
      <Ionicons name="card-outline" size={48} color="#4db3f4" style={{ marginBottom: 20 }} />
      <Text style={styles.title}>Freischaltung</Text>
      <Text style={styles.subtitle}>
        {isFlexJob ? 'Flex-Job Freischaltung' : 'Match freischalten'}
      </Text>
      {!!employee && (
        <Text style={styles.name}>{employee?.first_name} {employee?.last_name}</Text>
      )}
      <Text style={styles.hint}>
        {plan === 'premium' && 'Premium: kostenlos'}
        {plan === 'standard' && (isFlexJob ? 'Standard: 1,99 € je Flex-Job' : 'Standard: 10/Monat inkl., danach 9,99 €')}
        {plan === 'basic' && (isFlexJob ? 'Basic: Flex-Jobs nicht verfügbar' : 'Basic: 29 € pro Match')}
      </Text>
      <TouchableOpacity style={styles.payButton} onPress={handlePay} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>Jetzt fortfahren</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 8, fontSize: 14, color: '#6b7280' },
  name: { marginTop: 4, fontSize: 16, fontWeight: '600' },
  hint: { marginTop: 12, fontSize: 14, color: '#6b7280', textAlign: 'center' },
  payButton: { marginTop: 24, backgroundColor: '#4db3f4', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10 },
  payText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
