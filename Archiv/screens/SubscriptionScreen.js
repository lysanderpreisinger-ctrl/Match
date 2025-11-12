// screens/SubscriptionScreen.js
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  Alert, ActivityIndicator
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import i18n from '../i18n';

const C = {
  blue: '#4db3f4',
  blue500: '#3ca3e6',
  blue700: '#2a7fb7',
  bg: '#f7f8fb',
  card: '#ffffff',
  text: '#0f172a',
  sub: '#475569',
  line: '#e5e7eb',
};

// =====================================================
// ⚠️ STRIPE Price IDs – bitte in Stripe anlegen & hier eintragen
// =====================================================

// Abos (bestehend – du passt Preise in Stripe an)
const PRICE_STANDARD_MONTHLY_89 = 'price_1RufD3Bh0hSWnazMm76eBxCA'; // 89 €/Monat
const PRICE_PREMIUM_MONTHLY_199 = 'price_1RufFVBh0hSWnazMyCvGGgv2'; // 199 €/Monat

// Credits (NEU) – einmalige Zahlungen (mode: 'payment')
// -> bitte als "one-time" Produkte in Stripe anlegen und IDs hier einsetzen
const PRICE_CREDITS_3   = 'price_XXX_CREDITS_3';   // z.B. 3 Matches für 59 €
const PRICE_CREDITS_10  = 'price_XXX_CREDITS_10';  // z.B. 10 Matches für 179 €
const PRICE_CREDITS_25  = 'price_XXX_CREDITS_25';  // z.B. 25 Matches für 399 €

// Credits-Werte passend zu den Produkten oben
const CREDIT_PACKS = {
  [PRICE_CREDITS_3]: 3,
  [PRICE_CREDITS_10]: 10,
  [PRICE_CREDITS_25]: 25,
};

// =====================================================
// ⚠️ SUPABASE EDGE FUNCTION – Checkout Session erstellen
// =====================================================
const SUPABASE_FUNCTION_URL =
  'https://qrgcyvfrgepwhjzgth.functions.supabase.co/create-checkout-session';

// ⚠️ diese URLs müssen mit der Edge Function & Stripe übereinstimmen
const SUCCESS_URL = 'https://example.com/sub-success';
const CANCEL_URL  = 'https://example.com/sub-cancel';

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const session = route?.params?.session;

  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);

  // was wird gerade gekauft?
  // { type: 'subscription'|'credits'|'basic', plan?: 'standard'|'premium', priceId?: string }
  const currentPurchaseRef = useRef(null);

  const [activeTab, setActiveTab] = useState<'subs' | 'credits'>('subs');

  const t = (...args) => i18n.t(...args);

  const getUserId = useCallback(async () => {
    if (session?.user?.id) return session.user.id;
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  }, [session?.user?.id]);

  // stripe_subscriptions + profiles.subscription_plan pflegen
  const upsertSubscription = useCallback(async ({ userId, plan, status }) => {
    const { data: existing } = await supabase
      .from('stripe_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('stripe_subscriptions')
        .update({
          plan_name: plan,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('stripe_subscriptions')
        .insert({
          user_id: userId,
          plan_name: plan,
          status,
        });
      if (error) throw error;
    }
  }, []);

  const updateProfilePlan = useCallback(async ({ userId, plan }) => {
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_plan: plan, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  }, []);

  // Credits-Balance im Profil erhöhen (einfach & robust)
  const addCreditsToProfile = useCallback(async ({ userId, credits }) => {
    // Hole aktuelle Balance
    const { data: profile, error: getErr } = await supabase
      .from('profiles')
      .select('credit_balance')
      .eq('id', userId)
      .maybeSingle();
    if (getErr) throw getErr;

    const current = Number(profile?.credit_balance || 0);
    const next = current + Number(credits);

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ credit_balance: next, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (updErr) throw updErr;
  }, []);

  // unified checkout start
  const startCheckout = useCallback(async ({ priceId, mode }) => {
    // mode: 'subscription' | 'payment'
    const res = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        successUrl: SUCCESS_URL,
        cancelUrl: CANCEL_URL,
        mode,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || t('billing.errors.createSession'));
    }
    if (!data?.url) {
      throw new Error(t('billing.errors.noCheckoutUrl'));
    }
    return data.url;
  }, []);

  // Stripe WebView Navigation Handling
  const onNavChange = useCallback(async (nav) => {
    const url = nav?.url || '';
    if (!url) return;

    // Erfolg
    if (url.startsWith(SUCCESS_URL)) {
      try {
        const userId = await getUserId();
        if (!userId) throw new Error(t('billing.errors.noUser'));

        const purchase = currentPurchaseRef.current;
        if (!purchase) throw new Error(t('billing.errors.unknownPurchase'));

        if (purchase.type === 'subscription') {
          const plan = purchase.plan || 'standard';
          await upsertSubscription({ userId, plan, status: 'active' });
          await updateProfilePlan({ userId, plan });
          Alert.alert(t('billing.success.title'), t('billing.success.subscription', { plan: plan === 'premium' ? t('billing.plans.premium') : t('billing.plans.standard') }));
        } else if (purchase.type === 'credits') {
          const packCredits = CREDIT_PACKS[purchase.priceId] || 0;
          if (packCredits > 0) {
            await addCreditsToProfile({ userId, credits: packCredits });
            Alert.alert(t('billing.success.title'), t('billing.success.credits', { count: String(packCredits) }));
          } else {
            Alert.alert(t('billing.success.title'), t('billing.success.generic'));
          }
        }

        setCheckoutUrl(null);
        navigation.goBack();
      } catch (e) {
        Alert.alert(t('billing.errors.generic'), e.message);
        setCheckoutUrl(null);
        navigation.goBack();
      }
    }

    // Abbruch
    if (url.startsWith(CANCEL_URL)) {
      setCheckoutUrl(null);
    }
  }, [getUserId, navigation, upsertSubscription, updateProfilePlan, addCreditsToProfile]);

  // BASIC – kostenlos (nur in DB setzen)
  const chooseBasic = useCallback(async () => {
    setLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) throw new Error(t('billing.errors.noUser'));
      await upsertSubscription({ userId, plan: 'basic', status: 'active' });
      await updateProfilePlan({ userId, plan: 'basic' });
      Alert.alert(t('billing.success.active'), t('billing.success.basicActivated'));
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('billing.errors.generic'), e.message);
    } finally {
      setLoading(false);
    }
  }, [getUserId, navigation, upsertSubscription, updateProfilePlan]);

  // STANDARD Abo
  const chooseStandard = useCallback(async () => {
    setLoading(true);
    try {
      currentPurchaseRef.current = { type: 'subscription', plan: 'standard' };
      const url = await startCheckout({ priceId: PRICE_STANDARD_MONTHLY_89, mode: 'subscription' });
      setCheckoutUrl(url);
    } catch (e) {
      Alert.alert(t('billing.errors.generic'), e.message);
    } finally {
      setLoading(false);
    }
  }, [startCheckout]);

  // PREMIUM Abo
  const choosePremium = useCallback(async () => {
    setLoading(true);
    try {
      currentPurchaseRef.current = { type: 'subscription', plan: 'premium' };
      const url = await startCheckout({ priceId: PRICE_PREMIUM_MONTHLY_199, mode: 'subscription' });
      setCheckoutUrl(url);
    } catch (e) {
      Alert.alert(t('billing.errors.generic'), e.message);
    } finally {
      setLoading(false);
    }
  }, [startCheckout]);

  // Credits kaufen
  const buyCredits = useCallback(async (priceId) => {
    setLoading(true);
    try {
      currentPurchaseRef.current = { type: 'credits', priceId };
      const url = await startCheckout({ priceId, mode: 'payment' });
      setCheckoutUrl(url);
    } catch (e) {
      Alert.alert(t('billing.errors.generic'), e.message);
    } finally {
      setLoading(false);
    }
  }, [startCheckout]);

  // WebView bei aktivem Checkout
  if (checkoutUrl) {
    return (
      <WebView
        source={{ uri: checkoutUrl }}
        style={{ flex: 1 }}
        onNavigationStateChange={onNavChange}
      />
    );
  }

  // UI
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={C.blue} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('billing.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <SegmentTab
          label={t('billing.tabs.subscriptions')}
          active={activeTab === 'subs'}
          onPress={() => setActiveTab('subs')}
        />
        <SegmentTab
          label={t('billing.tabs.credits')}
          active={activeTab === 'credits'}
          onPress={() => setActiveTab('credits')}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {activeTab === 'subs' ? (
          <>
            {/* BASIC */}
            <PlanCard
              borderColor={C.blue}
              title={t('billing.plans.basic')}
              price={t('billing.basic.price')}
              subtitle={t('billing.basic.subtitle')}
              bulletColor={C.blue}
              bullets={[
                t('billing.basic.b1'),
                t('billing.basic.b2'),
                t('billing.basic.b3'),
              ]}
              cta={t('billing.basic.cta')}
              onPress={chooseBasic}
              loading={loading}
            />

            {/* STANDARD */}
            <PlanCard
              borderColor={C.blue500}
              title={t('billing.plans.standard')}
              price={t('billing.standard.price')}
              subtitle={t('billing.standard.subtitle')}
              bulletColor={C.blue500}
              bullets={[
                t('billing.standard.b1'),
                t('billing.standard.b2'),
                t('billing.standard.b3'),
                // ohne Branding/KI/PA – bewusst schlank
              ]}
              cta={t('billing.standard.cta')}
              onPress={chooseStandard}
              loading={loading}
              highlight
            />

            {/* PREMIUM */}
            <PlanCard
              borderColor={C.blue700}
              title={t('billing.plans.premium')}
              price={t('billing.premium.price')}
              subtitle={t('billing.premium.subtitle')}
              bulletColor={C.blue700}
              bullets={[
                t('billing.premium.b1'),
                t('billing.premium.b2'),
              ]}
              cta={t('billing.premium.cta')}
              onPress={choosePremium}
              loading={loading}
            />
          </>
        ) : (
          <>
            {/* Credits Intro */}
            <View style={[styles.card, { borderColor: C.blue }]}>
              <Text style={styles.planTitle}>{t('billing.credits.title')}</Text>
              <Text style={styles.subtitle}>{t('billing.credits.subtitle')}</Text>
            </View>

            {/* Credit Packs */}
            <CreditCard
              borderColor={C.blue}
              title={t('billing.credits.pack3.title')}
              price={t('billing.credits.pack3.price')}
              subtitle={t('billing.credits.pack3.subtitle')}
              bulletColor={C.blue}
              bullets={[
                t('billing.credits.common.b1'),
                t('billing.credits.common.b2'),
              ]}
              cta={t('billing.credits.cta')}
              onPress={() => buyCredits(PRICE_CREDITS_3)}
              loading={loading}
            />

            <CreditCard
              borderColor={C.blue500}
              title={t('billing.credits.pack10.title')}
              price={t('billing.credits.pack10.price')}
              subtitle={t('billing.credits.pack10.subtitle')}
              bulletColor={C.blue500}
              bullets={[
                t('billing.credits.common.b1'),
                t('billing.credits.common.b2'),
              ]}
              cta={t('billing.credits.cta')}
              onPress={() => buyCredits(PRICE_CREDITS_10)}
              loading={loading}
              highlight
            />

            <CreditCard
              borderColor={C.blue700}
              title={t('billing.credits.pack25.title')}
              price={t('billing.credits.pack25.price')}
              subtitle={t('billing.credits.pack25.subtitle')}
              bulletColor={C.blue700}
              bullets={[
                t('billing.credits.common.b1'),
                t('billing.credits.common.b2'),
              ]}
              cta={t('billing.credits.cta')}
              onPress={() => buyCredits(PRICE_CREDITS_25)}
              loading={loading}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SegmentTab({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PlanCard({ borderColor, title, price, subtitle, bulletColor, bullets, cta, onPress, loading, highlight }) {
  return (
    <View style={[
      styles.card,
      { borderColor },
      highlight && { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 }
    ]}>
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.price}>{price}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.features}>
        {bullets.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color={bulletColor} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: bulletColor }]}
        onPress={onPress}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{cta}</Text>}
      </TouchableOpacity>
    </View>
  );
}

function CreditCard(props) {
  return <PlanCard {...props} />;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.blue },
  tabsWrapper: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#eaf5fe' },
  tabText: { color: C.sub, fontWeight: '600' },
  tabTextActive: { color: C.blue, fontWeight: '800' },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: C.line,
  },
  planTitle: { textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 6 },
  price: { textAlign: 'center', fontSize: 20, fontWeight: '800', color: C.text },
  subtitle: { textAlign: 'center', color: C.sub, marginTop: 4 },
  features: { marginTop: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  featureText: { marginLeft: 8, color: C.text },
  cta: { marginTop: 14, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700' },
});
