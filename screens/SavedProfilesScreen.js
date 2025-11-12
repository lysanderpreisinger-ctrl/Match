// screens/SavedProfilesScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator,
  FlatList, TouchableOpacity
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import { supabase } from '../supabaseClient';

const PRIMARY = '#4db3f4';
const AVATAR_PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

export default function SavedProfilesScreen() {
  const navigation = useNavigation();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) setSession(data.session);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('saved_profiles')
      .select('id, saved_profile_id, created_at, profiles:profiles!saved_profiles_saved_profile_id_fkey(id, first_name, last_name, avatar_url, address_city, address_country)')
      .eq('saver_id', session.user.id)
      .order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);

  const remove = async (saved_profile_id) => {
    if (!session?.user?.id) return;
    await supabase
      .from('saved_profiles')
      .delete()
      .eq('saver_id', session.user.id)
      .eq('saved_profile_id', saved_profile_id);
    setRows((prev) => prev.filter(r => r.saved_profile_id !== saved_profile_id));
  };

  const rightActions = (id) => (
    <TouchableOpacity style={styles.swipeDelete} onPress={() => remove(id)}>
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <Text style={{ color: '#fff', marginTop: 4, fontWeight: '700' }}>Löschen</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const p = item.profiles || {};
    const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Profil';
    const avatar = p.avatar_url || AVATAR_PLACEHOLDER;

    return (
      <Swipeable renderRightActions={() => rightActions(p.id)}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('EmployeeProfileViewScreen', { profileId: p.id })}
        >
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.sub}>
              {p.address_city || '—'}, {p.address_country || '—'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gespeicherte Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: '#64748b' }}>Noch keine gespeicherten Profile.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const AVATAR = 48;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f8fb' },
  header: {
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  row: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: '#eef2f7' },
  name: { fontWeight: '700', color: '#0f172a' },
  sub: { color: '#64748b', marginTop: 2 },

  swipeDelete: {
    width: 88, backgroundColor: '#ef4444', alignItems: 'center',
    justifyContent: 'center', marginVertical: 6, borderRadius: 12,
  },
});
