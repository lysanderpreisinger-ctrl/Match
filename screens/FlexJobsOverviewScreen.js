// screens/FlexJobsOverviewScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import i18n from '../i18n';

const COLOR = {
  bg: '#f7f8fb',
  white: '#fff',
  primary: '#4db3f4',
  text: '#0f172a',
  sub: '#64748b',
  border: '#e2e8f0',
};

const PLACEHOLDER_AVATAR =
  'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

// kleine Helper-Funktion, damit keine [missing "..."]-Texte angezeigt werden
function t(key, fallback) {
  const val = i18n.t ? i18n.t(key) : key;
  if (typeof val === 'string' && !val.startsWith('[missing')) {
    return val;
  }
  return fallback || key;
}

export default function FlexJobsOverviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const session = route?.params?.session ?? null;
  const role = route?.params?.role ?? 'employee';
  const isEmployer = role === 'employer';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [view, setView] = useState('list');

  const loadData = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      // Standort holen (für Map)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }

      if (isEmployer) {
        // Arbeitgeber → verfügbare Arbeitnehmer
        const { data, error } = await supabase
          .from('profiles')
          .select(
            `id, full_name, first_name, last_name, address_city, avatar_url, latitude, longitude, flex_available`
          )
          .eq('role', 'employee');

        if (error) throw error;
        const filtered = (data || []).filter(
          (u) =>
            u.flex_available === true ||
            u.flex_available === null ||
            typeof u.flex_available === 'undefined'
        );
        setData(filtered);
      } else {
        // Arbeitnehmer → offene Flex-Jobs
        const { data, error } = await supabase
          .from('flex_jobs')
          .select('*')
          .neq('status', 'closed')
          .order('start_at', { ascending: true });

        if (error) throw error;
        setData(data || []);
      }
    } catch (e) {
      console.log('FlexJobsOverview load error:', e.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, isEmployer]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // --- List Items ---

  const renderEmployerCard = ({ item }) => {
    const name =
      item.full_name ||
      [item.first_name, item.last_name].filter(Boolean).join(' ') ||
      t('flex.overview.employer.fallbackName', 'Verfügbarer Arbeitnehmer');

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Image
            source={{ uri: item.avatar_url || PLACEHOLDER_AVATAR }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{name}</Text>
            <Text style={styles.cardSub}>
              {item.address_city || t('flex.overview.employer.fallbackCity', 'Ort nicht angegeben')}
            </Text>
          </View>
          <TouchableOpacity style={styles.cardBtn}>
            <Text style={styles.cardBtnText}>
              {t('flex.overview.employer.cta', 'Flex anfragen')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmployeeCard = ({ item }) => {
    const when = (() => {
      if (!item.start_at) return t('flex.overview.employee.timeUnknown', 'Zeit offen');
      const d = new Date(item.start_at);
      return d.toLocaleString('de-DE', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    })();

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Ionicons name="flash-outline" size={20} color={COLOR.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              {item.title || t('flex.overview.employee.fallbackTitle', 'Flex-Job')}
            </Text>
            <Text style={styles.cardSub}>
              {(item.address_city || '—') + ' · ' + when}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.badgeText, { color: '#065f46' }]}>
              {t('flex.overview.employee.badge', 'Offen')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // --- Marker ---
  const markers = data
    .map((it) => {
      const lat = it.latitude;
      const lon = it.longitude;
      if (!lat || !lon) return null;
      return {
        id: it.id,
        latitude: Number(lat),
        longitude: Number(lon),
        title: isEmployer
          ? it.full_name ||
            it.first_name ||
            t('flex.overview.employer.fallbackName', 'Verfügbarer Arbeitnehmer')
          : it.title || t('flex.overview.employee.fallbackTitle', 'Flex-Job'),
        description: it.address_city || '',
      };
    })
    .filter(Boolean);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLOR.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>jatch</Text>
        {isEmployer ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('FlexJobCreate', { session })}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.headerBtnText}>
              {t('flex.overview.create', 'Flex-Job')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 74 }} />
        )}
      </View>

      {/* Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'list' && styles.toggleBtnActive]}
          onPress={() => setView('list')}
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={view === 'list' ? '#fff' : COLOR.primary}
          />
          <Text
            style={[styles.toggleText, view === 'list' && styles.toggleTextActive]}
          >
            {t('flex.overview.list', 'Liste')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'map' && styles.toggleBtnActive]}
          onPress={() => setView('map')}
        >
          <Ionicons
            name="map-outline"
            size={18}
            color={view === 'map' ? '#fff' : COLOR.primary}
          />
          <Text
            style={[styles.toggleText, view === 'map' && styles.toggleTextActive]}
          >
            {t('flex.overview.map', 'Karte')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inhalt */}
      {view === 'list' ? (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={isEmployer ? renderEmployerCard : renderEmployeeCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>⚡️</Text>
              <Text style={styles.emptyTitle}>
                {isEmployer
                  ? t('flex.overview.emptyEmployersTitle', 'Keine Arbeitnehmer gefunden')
                  : t('flex.overview.emptyEmployeesTitle', 'Keine Flex-Jobs gefunden')}
              </Text>
              <Text style={styles.emptySub}>
                {isEmployer
                  ? t(
                      'flex.overview.emptyEmployersText',
                      'Aktuell bietet niemand seine Unterstützung an. Schau später nochmal rein.'
                    )
                  : t(
                      'flex.overview.emptyEmployeesText',
                      'Aktuell sind keine spontanen Jobs online. Schau später nochmal rein.'
                    )}
              </Text>
            </View>
          }
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: userLocation?.latitude || 48.137154,
              longitude: userLocation?.longitude || 11.576124,
              latitudeDelta: 0.15,
              longitudeDelta: 0.15,
            }}
            showsUserLocation
          >
            {markers.map((m) => (
              <Marker
                key={m.id}
                coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                title={m.title}
                description={m.description}
              />
            ))}
          </MapView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.white },

  header: {
    backgroundColor: COLOR.white,
    paddingTop: 56,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLOR.primary },
  headerBtn: {
    position: 'absolute',
    right: 16,
    top: 56,
    backgroundColor: COLOR.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtnText: { color: '#fff', fontWeight: '600', marginLeft: 4, fontSize: 13 },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: COLOR.white,
    paddingVertical: 10,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLOR.primary,
  },
  toggleBtnActive: { backgroundColor: COLOR.primary },
  toggleText: { marginLeft: 6, color: COLOR.primary, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },

  card: {
    backgroundColor: COLOR.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLOR.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLOR.text },
  cardSub: { fontSize: 12, color: COLOR.sub, marginTop: 2 },

  cardBtn: {
    backgroundColor: COLOR.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e6f2fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },

  emptyBox: {
    backgroundColor: COLOR.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 34, marginBottom: 4 },
  emptyTitle: { fontWeight: '700', color: COLOR.text, marginBottom: 4 },
  emptySub: { color: COLOR.sub, fontSize: 13, textAlign: 'center' },
});
