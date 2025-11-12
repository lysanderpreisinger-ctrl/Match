// screens/ChatsAndMatchesScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../supabaseClient';
import { useLang } from '../LanguageContext';

const COLOR = {
  bg: '#f2f2f2',
  white: '#fff',
  primary: '#4db3f4',
  sub: '#94a3b8',
  line: '#e2e8f0',
};

export default function ChatsAndMatchesScreen({ route }) {
  const { session, role } = route.params || {};
  const userId = session?.user?.id;
  const isEmployer = role === 'employer';
  const navigation = useNavigation();
  const { t } = useLang();

  // kleine helper-funktion: nimm t(key), aber wenn nix vorhanden → fallback
  function tt(key, fallback) {
    if (!t) return fallback;
    const val = t(key);
    if (!val || val === key) return fallback;
    return val;
  }

  const [subscriptionPlan, setSubscriptionPlan] = useState(null); // basic | standard | premium
  const [matches, setMatches] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlocksThisMonth, setUnlocksThisMonth] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!userId) return;
      setLoading(true);
      await Promise.all([
        fetchProfile(),
        fetchMatches(),
        fetchChats(),
        isEmployer ? fetchMonthlyUnlocks() : Promise.resolve(),
      ]);
      if (isMounted) setLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [userId, role]);

  async function fetchProfile() {
    if (!userId) return;
    const { data } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', userId)
      .maybeSingle();
    setSubscriptionPlan(data?.subscription_plan || null);
  }

  async function fetchMatches() {
    if (!userId) return;

    const sel = isEmployer
      ? `
        id, status, match_percentage,
        employer_unlocked, employer_payment_status, created_at,
        employee:employee_id ( id, first_name, last_name, avatar_url )
      `
      : `
        id, status, match_percentage,
        employer_unlocked, employer_payment_status, created_at,
        employer:employer_id ( id, company_name, company_logo_url )
      `;

    const { data, error } = await supabase
      .from('matches')
      .select(sel)
      .eq(isEmployer ? 'employer_id' : 'employee_id', userId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false });

    if (!error) setMatches(data ?? []);
  }

  async function fetchChats() {
    if (!userId) return;

    const { data, error } = await supabase
      .from('chats')
      .select(`
        id,
        last_message,
        is_read,
        updated_at,
        partner:profiles!partner_id (
          id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error) setChats(data ?? []);
  }

  async function fetchMonthlyUnlocks() {
    if (!userId) return;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await supabase
      .from('matches')
      .select('id')
      .eq('employer_id', userId)
      .eq('employer_unlocked', true)
      .gte('created_at', firstDay);

    if (!error) setUnlocksThisMonth((data || []).length);
  }

  async function deleteChat(chatId) {
    const { error } = await supabase.from('chats').delete().eq('id', chatId);
    if (error) Alert.alert(tt('chats.deleteError', 'Fehler beim Löschen'));
    else setChats((prev) => prev.filter((c) => c.id !== chatId));
  }

  const RightActions = (id) => (
    <TouchableOpacity style={styles.deleteButton} onPress={() => deleteChat(id)}>
      <Text style={styles.deleteText}>{tt('chats.delete', 'Löschen')}</Text>
    </TouchableOpacity>
  );

  const unlockMatch = useCallback(
    async (match) => {
      if (!isEmployer) return;
      const plan = subscriptionPlan || 'basic';

      // PREMIUM → kostenlos
      if (plan === 'premium') {
        await supabase
          .from('matches')
          .update({ employer_unlocked: true, employer_payment_status: 'free' })
          .eq('id', match.id);
        await fetchMatches();
        return;
      }

      // STANDARD → 10 frei
      if (plan === 'standard') {
        if (unlocksThisMonth < 10) {
          await supabase
            .from('matches')
            .update({ employer_unlocked: true, employer_payment_status: 'free' })
            .eq('id', match.id);
          await fetchMatches();
          await fetchMonthlyUnlocks();
          Alert.alert(
            tt('chats.matchUnlocked', 'Match freigeschaltet'),
            tt(
              'chats.matchUnlockedInfo',
              'Dieses Match zählt zu deinen 10 freien im Monat.'
            )
          );
          return;
        }

        // ab 11. Match → 9,99
        Alert.alert(
          tt('chats.payMatch', 'Match freischalten'),
          tt(
            'chats.payMatchText',
            'Du hast deine 10 kostenlosen Matches verbraucht. Dieses Match für 9,99 € freischalten?'
          ),
          [
            { text: tt('common.cancel', 'Abbrechen'), style: 'cancel' },
            {
              text: tt('common.continue', 'Weiter'),
              onPress: () => {
                navigation.navigate('PaymentScreen', {
                  session,
                  matchId: match.id,
                  amount: 9.99,
                  reason: 'extra-match',
                });
              },
            },
          ]
        );
        return;
      }

      // BASIC → immer 29,99
      Alert.alert(
        tt('chats.payMatch', 'Match freischalten'),
        tt(
          'chats.payMatchBasicText',
          'Du nutzt aktuell den Basic-Tarif. Dieses Match für 29,99 € freischalten?'
        ),
        [
          { text: tt('common.cancel', 'Abbrechen'), style: 'cancel' },
          {
            text: tt('common.continue', 'Weiter'),
            onPress: () => {
              navigation.navigate('PaymentScreen', {
                session,
                matchId: match.id,
                amount: 29.99,
                reason: 'match-basic',
              });
            },
          },
        ]
      );
    },
    [isEmployer, subscriptionPlan, unlocksThisMonth, navigation, session, t]
  );

  function openMatchChat(match) {
    const isUnlocked =
      match.employer_unlocked ||
      match.employer_payment_status === 'free' ||
      match.employer_payment_status === 'paid';

    const data = isEmployer ? match.employee : match.employer;
    if (!data) return;

    if (isEmployer && !isUnlocked) {
      unlockMatch(match);
      return;
    }

    if (!isEmployer && !isUnlocked) {
      Alert.alert(
        tt('chats.locked', 'Dieses Match ist noch nicht freigeschaltet.'),
        tt(
          'chats.lockedInfo',
          'Der Arbeitgeber muss dein Match zuerst freigeben.'
        )
      );
      return;
    }

    const displayName = isEmployer
      ? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()
      : data.company_name;
    const avatar = isEmployer ? data.avatar_url : data.company_logo_url;

    navigation.navigate('ChatDetail', {
      matchId: match.id,
      otherUser: { id: data.id, name: displayName, avatar },
      role,
      session,
    });
  }

  const renderChatItem = ({ item }) => {
    const other = item.partner ?? {};
    return (
      <Swipeable renderRightActions={() => RightActions(item.id)}>
        <TouchableOpacity
          style={styles.chatContainer}
          onPress={() =>
            navigation.navigate('ChatDetail', {
              chatId: item.id,
              session,
              partner: other,
              role,
            })
          }
        >
          <Image
            source={{ uri: other.avatar_url || 'https://via.placeholder.com/100' }}
            style={styles.avatar}
          />
          <View style={styles.chatInfo}>
            <Text style={styles.name}>
              {(other.first_name || '') + ' ' + (other.last_name || '')}
            </Text>
            <Text
              style={[
                styles.message,
                !item.is_read && styles.unread,
              ]}
              numberOfLines={1}
            >
              {item.last_message || tt('chats.noMessages', 'Keine Nachricht')}
            </Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderMatchItem = ({ item }) => {
    const data = isEmployer ? item.employee : item.employer;
    if (!data) return null;

    const displayName = isEmployer
      ? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()
      : data.company_name;
    const avatar = isEmployer ? data.avatar_url : data.company_logo_url;

    const isUnlocked =
      item.employer_unlocked ||
      item.employer_payment_status === 'free' ||
      item.employer_payment_status === 'paid';

    return (
      <TouchableOpacity style={styles.matchCard} onPress={() => openMatchChat(item)}>
        <Image
          source={{ uri: avatar || 'https://via.placeholder.com/100' }}
          style={styles.matchAvatar}
        />
        <Text style={styles.matchName} numberOfLines={1}>
          {displayName}
        </Text>

        {!isUnlocked && isEmployer ? (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed-outline" size={14} color="#fff" />
            <Text style={styles.lockText}>
              {subscriptionPlan === 'basic' ? '29,99 €' : '9,99 €'}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLOR.primary} />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>jatch</Text>
        </View>

        {/* Matches */}
        <View style={styles.matchesSection}>
          <Text style={styles.sectionTitle}>
            {tt('chats.matches', 'Matches')}
          </Text>

          {matches.length === 0 ? (
            <TouchableOpacity
              style={styles.noMatchBox}
              onPress={() =>
                navigation.navigate('Main', {
                  screen: 'SwipesTab',
                  params: { session, role },
                })
              }
            >
              <Ionicons name="sparkles-outline" size={26} color={COLOR.primary} />
              <Text style={styles.noMatchTitle}>
                {tt('chats.noMatchesTitle', 'Noch keine Matches')}
              </Text>
              <Text style={styles.noMatchSub}>
                {tt(
                  'chats.noMatchesSub',
                  'Swipe los und finde passende Kandidaten.'
                )}
              </Text>
              <View style={styles.noMatchBtn}>
                <Text style={styles.noMatchBtnText}>
                  {tt('chats.goToSwipes', 'Zu den Swipes')}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : (
            <FlatList
              horizontal
              data={matches}
              keyExtractor={(it) => String(it.id)}
              renderItem={renderMatchItem}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.matchList}
            />
          )}
        </View>

        {/* Chats */}
        <View style={styles.chatsSection}>
          <Text style={styles.sectionTitle}>
            {tt('chats.chats', 'Chats')}
          </Text>
          {chats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={30} color={COLOR.sub} />
              <Text style={styles.infoText}>
                {tt('chats.noChats', 'Du hast bisher noch keine Chats')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={chats}
              keyExtractor={(it) => String(it.id)}
              renderItem={renderChatItem}
            />
          )}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'center',
    backgroundColor: COLOR.white,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: COLOR.primary },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 16,
    marginBottom: 8,
    color: '#333',
  },

  matchesSection: { paddingVertical: 8, backgroundColor: COLOR.white },
  matchList: { paddingHorizontal: 16, paddingBottom: 8 },

  matchCard: {
    width: 110,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  matchAvatar: { width: 56, height: 56, borderRadius: 28, marginBottom: 8 },
  matchName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  lockBadge: {
    marginTop: 6,
    backgroundColor: '#f97316',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lockText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  noMatchBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 18,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 6,
  },
  noMatchTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  noMatchSub: { color: '#64748b', marginBottom: 6, maxWidth: '80%' },
  noMatchBtn: {
    backgroundColor: COLOR.primary,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  noMatchBtnText: { color: '#fff', fontWeight: '600' },

  chatsSection: { flex: 1, marginTop: 8 },
  chatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#e2e8f0',
  },
  chatInfo: { flex: 1 },
  name: { fontWeight: 'bold', fontSize: 16 },
  message: { fontSize: 14, color: COLOR.sub, marginTop: 4 },
  unread: { fontWeight: 'bold', color: COLOR.primary },

  deleteButton: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 6,
    marginRight: 16,
  },
  deleteText: { color: '#fff', fontWeight: 'bold' },

  infoText: { color: '#888', fontSize: 15, textAlign: 'center', marginTop: 8 },
  emptyContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
