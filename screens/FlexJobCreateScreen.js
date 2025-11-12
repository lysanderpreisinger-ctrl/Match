// screens/FlexJobCreateScreen.js
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Platform,
  InputAccessoryView,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '../supabaseClient';

const MIN_WAGE_2025 = 12.82;
const CATEGORIES = [
  'Gastronomie',
  'Barista',
  'Servicekraft',
  'Küche/Spülhilfe',
  'Eventhilfe',
  'Security/Personenschutz',
  'Promotion',
  'Einlass/Kasse',
  'Fahrer/Fahrdienst',
  'Sonstiges',
];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const TIME_STEP_MIN = 15;

export default function FlexJobCreateScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const session = params?.session;

  // --- FORM ---
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [driverLabel, setDriverLabel] = useState('');
  const [hourlyRate, setHourlyRate] = useState(String(MIN_WAGE_2025));
  const [hoursNeeded, setHoursNeeded] = useState(4);
  const [tasks, setTasks] = useState('');
  const [tasksFocused, setTasksFocused] = useState(false);

  // Adresse
  const [addressLine, setAddressLine] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  // Modals
  const [addressModal, setAddressModal] = useState(false);
  const [addrQuery, setAddrQuery] = useState('');
  const [addrSuggestions, setAddrSuggestions] = useState([]);
  const [addrSearching, setAddrSearching] = useState(false);
  const addrTimer = useRef(null);

  // Datum / Zeit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 4, 0, 0, 0);
    return d;
  });
  const [dateModal, setDateModal] = useState(false);
  const [timeModal, setTimeModal] = useState(false);
  const [hoursModal, setHoursModal] = useState(false);

  // Rechts/Praxis
  const [legalOpen, setLegalOpen] = useState(false);

  const scrollRef = useRef(null);
  const tasksRef = useRef(null);

  const isDriverCategory = category === 'Fahrer/Fahrdienst';
  const tasksAccessoryId = 'tasksDoneBar';
  const isIOS = Platform.OS === 'ios';

  // ---- Datum & Zeit ----
  const DATE_CHOICES = useMemo(() => {
    const arr = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 4; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  const TIME_CHOICES = useMemo(() => {
    const slots = [];
    const isToday = date.toDateString() === new Date().toDateString();
    const start = new Date(date);
    if (isToday) {
      const now = new Date();
      const rounded = new Date(
        Math.ceil(now.getTime() / (TIME_STEP_MIN * 60000)) * (TIME_STEP_MIN * 60000)
      );
      start.setHours(rounded.getHours(), rounded.getMinutes(), 0, 0);
    } else {
      start.setHours(0, 0, 0, 0);
    }
    const end = new Date(date);
    end.setHours(23, 45, 0, 0);
    for (let t = start; t <= end; t = new Date(t.getTime() + TIME_STEP_MIN * 60000)) {
      slots.push(new Date(t));
    }
    return slots;
  }, [date]);

  function formatDate(d) {
    return d.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
  }
  function formatTime(d) {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  function composeStartDateTime() {
    const start = new Date(date);
    start.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return start;
  }

  // ---- Adresse ----
  function openAddressModal() {
    setAddrQuery(addressLine);
    setAddressModal(true);
    if (addressLine.trim().length >= 3) scheduleAddrSearch(addressLine);
  }

  function scheduleAddrSearch(q) {
    if (addrTimer.current) clearTimeout(addrTimer.current);
    if (!q || q.trim().length < 3) {
      setAddrSuggestions([]);
      return;
    }
    addrTimer.current = setTimeout(() => fetchAddrSuggestions(q), 350);
  }

  async function fetchAddrSuggestions(q) {
    try {
      setAddrSearching(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=de&limit=8&q=${encodeURIComponent(
        q
      )}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'jatch-app/1.0 (kontakt@example.com)',
          'Accept-Language': 'de',
        },
      });
      const list = await res.json();
      setAddrSuggestions(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('addr suggestions error', e);
    } finally {
      setAddrSearching(false);
    }
  }

  async function useCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Standort', 'Bitte Standortzugriff erlauben.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'jatch-app/1.0 (kontakt@example.com)',
          'Accept-Language': 'de',
        },
      });
      const js = await res.json();
      const addr = js.address || {};

      const streetName = addr.road || addr.pedestrian || addr.path || '';
      const house = addr.house_number || '';
      const postal = addr.postcode || '';
      const cityName = addr.city || addr.town || addr.village || '';

      setLatitude(lat);
      setLongitude(lon);
      setStreet(streetName);
      setHouseNumber(house);
      setZip(postal);
      setCity(cityName);
      const line =
        [streetName, house].filter(Boolean).join(' ') +
        ', ' +
        [postal, cityName].filter(Boolean).join(' ');
      setAddressLine(line.trim());
      setAddressModal(false);
    } catch (e) {
      console.warn('useCurrentLocation error', e);
      Alert.alert('Fehler', 'Standort konnte nicht bestimmt werden.');
    }
  }

  function pickAddrSuggestion(item) {
    const addr = item.address || {};
    const streetName = addr.road || addr.pedestrian || addr.path || '';
    const house = addr.house_number || '';
    const postal = addr.postcode || '';
    const cityName = addr.city || addr.town || addr.village || '';

    setLatitude(item.lat ? Number(item.lat) : null);
    setLongitude(item.lon ? Number(item.lon) : null);
    setStreet(streetName);
    setHouseNumber(house);
    setZip(postal);
    setCity(cityName);

    const line =
      item.display_name ||
      [streetName, house].filter(Boolean).join(' ') +
        ', ' +
        [postal, cityName].filter(Boolean).join(' ');
    setAddressLine(line);
    setAddressModal(false);
  }

  // ---- Validate & Save ----
  function validate() {
    if (!session?.user?.id) {
      Alert.alert('Fehler', 'Keine Session gefunden.');
      return false;
    }
    if (!title.trim()) {
      Alert.alert('Bitte Titel angeben', 'Beschreibe kurz den Flex-Job.');
      return false;
    }
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < MIN_WAGE_2025) {
      Alert.alert('Stundensatz zu niedrig', `Mindestens ${MIN_WAGE_2025.toFixed(2)} € pro Stunde.`);
      return false;
    }
    if (!Number.isInteger(hoursNeeded) || hoursNeeded < 1 || hoursNeeded > 12) {
      Alert.alert('Stunden prüfen', 'Bitte 1–12 Stunden auswählen.');
      return false;
    }
    if (!addressLine.trim() || !street.trim() || !city.trim() || !zip.trim()) {
      Alert.alert('Adresse unvollständig', 'Bitte eine vollständige Adresse auswählen.');
      return false;
    }
    const startAt = composeStartDateTime();
    const max = new Date();
    max.setDate(max.getDate() + 4);
    max.setHours(23, 59, 59, 999);
    if (startAt.getTime() > max.getTime()) {
      Alert.alert('Zu weit in der Zukunft', 'Flex-Jobs dürfen max. 4 Tage im Voraus erstellt werden.');
      return false;
    }
    if (startAt.getTime() < Date.now()) {
      Alert.alert('Startzeit prüfen', 'Die Startzeit darf nicht in der Vergangenheit liegen.');
      return false;
    }
    return true;
  }

  async function save() {
    if (!validate()) return;

    const startAt = composeStartDateTime();
    const expiresAt = new Date(startAt);
    expiresAt.setDate(expiresAt.getDate() + 1);

    const fullPayload = {
      employer_id: session.user.id,
      title: title.trim(),
      category,
      driver_label: isDriverCategory ? driverLabel.trim() || null : null,
      hourly_rate: Number(hourlyRate),
      hours_needed: Number(hoursNeeded),
      tasks: tasks.trim(),
      address_street: street.trim(),
      address_house_number: houseNumber.trim() || null,
      address_zip: zip.trim() || null,
      address_city: city.trim(),
      latitude,
      longitude,
      start_at: startAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'open',
      type: 'flex',
      created_at: new Date().toISOString(),
    };

    // 1. Versuch: alles
    let { error } = await supabase.from('flex_jobs').insert(fullPayload);

    // 2. Fallback bei Schema-Unterschieden
    if (
      error &&
      /schema cache|column|address_house_number|address_zip|driver_label|latitude|longitude/i.test(
        error.message || ''
      )
    ) {
      const fallbackPayload = {
        employer_id: fullPayload.employer_id,
        title: fullPayload.title,
        category: fullPayload.category,
        hourly_rate: fullPayload.hourly_rate,
        hours_needed: fullPayload.hours_needed,
        tasks: fullPayload.tasks,
        address_street: fullPayload.address_street,
        address_city: fullPayload.address_city,
        start_at: fullPayload.start_at,
        expires_at: fullPayload.expires_at,
        status: fullPayload.status,
        type: fullPayload.type,
        created_at: fullPayload.created_at,
      };
      const res2 = await supabase.from('flex_jobs').insert(fallbackPayload);
      error = res2.error || null;
    }

    if (error) {
      console.warn('flex_jobs insert error:', error);
      Alert.alert(
        'Speichern fehlgeschlagen',
        error.message || 'Bitte prüfe die Eingaben oder versuche es später erneut.'
      );
      return;
    }

    Alert.alert('Flex-Job angelegt', 'Dein Flex-Job ist veröffentlicht.');
    navigation.goBack();
  }

  // ---- UI ----
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <Ionicons name="chevron-back" size={22} color="#4b5563" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Flex-Job erstellen</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* INFO CARD OBEN */}
          <View style={styles.topCard}>
            <View style={styles.topIconWrap}>
              <Ionicons name="flash-outline" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.topCardTitle}>Kurzfristige Einsätze posten</Text>
              <Text style={styles.topCardSub}>
                Für Planungen {'>'} 4 Tage bitte eine normale Stellenanzeige nutzen.
              </Text>
            </View>
          </View>

          {/* RECHTLICHES */}
          <TouchableOpacity
            style={styles.infoToggle}
            onPress={() => setLegalOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={legalOpen ? 'information-circle' : 'information-circle-outline'}
              size={18}
              color="#4db3f4"
            />
            <Text style={styles.infoToggleText}>Rechtliches & Praxis</Text>
            <Ionicons
              name={legalOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#6b7280"
            />
          </TouchableOpacity>

          {legalOpen && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Kurzfristige Aushilfen (heute / Wochenende). Max. 4 Tage Vorlauf.
              </Text>
              <View style={styles.inlineInfo}>
                <Ionicons name="bulb-outline" size={16} color="#4db3f4" />
                <Text style={styles.inlineInfoText}>
                  Für längere Planung → normale Stellenanzeige posten.
                </Text>
              </View>
              <Text style={styles.infoBul}>• Mindestlohn mind. 12,82 €/h.</Text>
              <Text style={styles.infoBul}>
                • Meist Minijob / kurzfristige Beschäftigung (ggf. Sofortmeldung).
              </Text>
              <Text style={styles.infoBul}>• Unfallversicherung nicht vergessen.</Text>
              <Text style={styles.infoSmall}>Keine Rechtsberatung.</Text>
            </View>
          )}

          {/* FORM CARD */}
          <View style={styles.formCard}>
            <Label text="Kategorie" hint="Passenden Bereich wählen." />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 6, marginBottom: 4 }}
            >
              <View style={styles.chipsRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, c === category && styles.chipActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text
                      style={[styles.chipText, c === category && styles.chipTextActive]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {isDriverCategory && (
              <>
                <Label text="Fahrer-Bezeichnung" hint="z. B. Lieferfahrer, Shuttle" />
                <TextInput
                  placeholder="z. B. Lieferfahrer, Shuttle"
                  placeholderTextColor="#9ca3af"
                  style={styles.input}
                  value={driverLabel}
                  onChangeText={setDriverLabel}
                />
              </>
            )}

            <Label text="Titel" hint="Das sehen Bewerber:innen zuerst." />
            <TextInput
              placeholder="z. B. Barista für heute Abend"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              value={title}
              onChangeText={setTitle}
            />

            <Label
              text="Stundensatz (€)"
              hint={`Mindestens ${MIN_WAGE_2025.toFixed(2)} € – gesetzlicher Mindestlohn.`}
            />
            <TextInput
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder={`${MIN_WAGE_2025.toFixed(2)}`}
              placeholderTextColor="#9ca3af"
              value={hourlyRate}
              onChangeText={setHourlyRate}
            />

            <Label text="Benötigte Stunden" hint="1–12 Stunden" />
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setHoursModal(true)}>
              <Ionicons name="hourglass-outline" size={18} color="#4db3f4" />
              <Text style={styles.selectorText}>{hoursNeeded}h</Text>
            </TouchableOpacity>

            <Label text="Adresse" hint="Vollständige Adresse auswählen" />
            <TouchableOpacity onPress={openAddressModal} activeOpacity={0.85}>
              <View pointerEvents="none">
                <TextInput
                  placeholder="Vollständige Adresse"
                  placeholderTextColor="#9ca3af"
                  style={styles.input}
                  value={addressLine}
                  editable={false}
                />
              </View>
            </TouchableOpacity>

            <Label text="Start" hint="max. 4 Tage im Voraus" />
            <View style={styles.row2}>
              <TouchableOpacity
                style={[styles.selectorBtn, { marginRight: 6 }]}
                onPress={() => setDateModal(true)}
              >
                <Ionicons name="calendar-outline" size={18} color="#4db3f4" />
                <Text style={styles.selectorText}>{formatDate(date)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectorBtn, { marginLeft: 6 }]}
                onPress={() => setTimeModal(true)}
              >
                <Ionicons name="time-outline" size={18} color="#4db3f4" />
                <Text style={styles.selectorText}>{formatTime(time)}</Text>
              </TouchableOpacity>
            </View>

            <Label text="Aufgaben / Anforderungen" hint="kurz & klar" />
            <TextInput
              ref={tasksRef}
              placeholder="z. B. Getränke zubereiten, Kassieren, freundlich bleiben"
              placeholderTextColor="#9ca3af"
              style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
              value={tasks}
              onChangeText={setTasks}
              multiline
              inputAccessoryViewID={isIOS ? tasksAccessoryId : undefined}
              onFocus={() => {
                setTasksFocused(true);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
              }}
              onBlur={() => setTasksFocused(false)}
            />
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            <Text style={styles.saveText}>Flex-Job veröffentlichen</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* iOS Done bar */}
      {isIOS && (
        <InputAccessoryView nativeID={tasksAccessoryId}>
          <View style={styles.accessoryBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={styles.accessoryBtn}
              onPress={() => Keyboard.dismiss()}
            >
              <Text style={styles.accessoryBtnText}>Fertig</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      {/* Android Done bar */}
      {!isIOS && tasksFocused && (
        <View style={styles.androidDoneBar}>
          <TouchableOpacity onPress={() => Keyboard.dismiss()}>
            <Text style={styles.accessoryBtnText}>Fertig</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- MODALS --- */}
      {/* Datum */}
      <Modal
        visible={dateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Datum wählen</Text>
            {DATE_CHOICES.map((d) => (
              <TouchableOpacity
                key={d.toISOString()}
                style={styles.modalItem}
                onPress={() => {
                  setDate(d);
                  setDateModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{formatDate(d)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setDateModal(false)}>
              <Text style={styles.modalCloseText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Uhrzeit */}
      <Modal
        visible={timeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setTimeModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardLarge}>
            <Text style={styles.modalTitle}>Uhrzeit wählen</Text>
            <FlatList
              data={TIME_CHOICES}
              keyExtractor={(i) => i.getTime().toString()}
              style={{ maxHeight: 320, width: '100%' }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setTime(item);
                    setTimeModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{formatTime(item)}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setTimeModal(false)}>
              <Text style={styles.modalCloseText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Stunden */}
      <Modal
        visible={hoursModal}
        transparent
        animationType="fade"
        onRequestClose={() => setHoursModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Benötigte Stunden</Text>
            {HOUR_OPTIONS.map((h) => (
              <TouchableOpacity
                key={h}
                style={styles.modalItem}
                onPress={() => {
                  setHoursNeeded(h);
                  setHoursModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{h} Stunden</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setHoursModal(false)}>
              <Text style={styles.modalCloseText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Adresse */}
      <Modal
        visible={addressModal}
        animationType="slide"
        onRequestClose={() => setAddressModal(false)}
      >
        <SafeAreaView style={styles.addrContainer}>
          <View style={styles.addrHeader}>
            <Text style={styles.addrTitle}>Standort eingeben</Text>
            <TouchableOpacity style={styles.addrCancel} onPress={() => setAddressModal(false)}>
              <Text style={styles.addrCancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <TextInput
              autoFocus
              placeholder="Vollständige Adresse"
              placeholderTextColor="#d1d5db"
              style={styles.addrInput}
              value={addrQuery}
              onChangeText={(v) => {
                setAddrQuery(v);
                scheduleAddrSearch(v);
              }}
            />
          </View>

          <TouchableOpacity style={styles.addrCurrent} onPress={useCurrentLocation}>
            <Ionicons name="navigate-outline" size={18} color="#fff" />
            <Text style={styles.addrCurrentText}>Aktueller Standort</Text>
          </TouchableOpacity>

          {addrSearching && (
            <ActivityIndicator size="small" color="#fff" style={{ marginTop: 10 }} />
          )}

          <FlatList
            data={addrSuggestions}
            keyExtractor={(item) => String(item.place_id)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.addrItem}
                onPress={() => pickAddrSuggestion(item)}
              >
                <Ionicons name="location-outline" size={18} color="#cbd5e1" />
                <Text style={styles.addrItemText}>{item.display_name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !addrSearching && addrQuery.length >= 3 ? (
                <Text style={{ color: '#cbd5e1', paddingHorizontal: 16, marginTop: 8 }}>
                  Keine Treffer – Formulierung ändern oder Standort übernehmen.
                </Text>
              ) : null
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* --- Helper Label --- */
function Label({ text, hint }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.labelWrap}>
      <View style={styles.labelRow}>
        <Text style={styles.labelText}>{text}</Text>
        {hint ? (
          <TouchableOpacity onPress={() => setOpen((v) => !v)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons
              name={open ? 'help-circle' : 'help-circle-outline'}
              size={17}
              color="#4db3f4"
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {open ? <Text style={styles.inlineHint}>{hint}</Text> : null}
    </View>
  );
}

/* --- Styles --- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fb' },
  content: { padding: 16, paddingBottom: 50 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 21, fontWeight: '700', color: '#111827' },

  topCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  topIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#4db3f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topCardTitle: { fontWeight: '700', color: '#111827' },
  topCardSub: { color: '#6b7280', marginTop: 2, fontSize: 12 },

  infoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    marginTop: 2,
  },
  infoToggleText: { color: '#1f2937', fontWeight: '600', flex: 1 },
  infoBox: {
    backgroundColor: '#e6f2fb',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderColor: '#d1e6ff',
    borderWidth: 1,
  },
  infoText: { color: '#374151' },
  inlineInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  inlineInfoText: { color: '#1f2937', flex: 1 },
  infoBul: { color: '#374151', marginTop: 6, fontSize: 13 },
  infoSmall: { color: '#6b7280', fontSize: 11, marginTop: 6 },

  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  labelWrap: { marginTop: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelText: { color: '#374151', fontWeight: '600' },
  inlineHint: { color: '#6b7280', marginTop: 3, fontSize: 12 },

  input: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 15,
    marginTop: 6,
  },

  chipsRow: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#4db3f4', borderColor: '#4db3f4' },
  chipText: { color: '#374151', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  row2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  selectorText: { marginLeft: 8, color: '#0f172a', fontWeight: '600' },

  saveBtn: {
    backgroundColor: '#4db3f4',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 2,
    marginBottom: 10,
  },
  saveText: { color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 16 },

  accessoryBar: {
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accessoryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#4db3f4',
    borderRadius: 8,
  },
  accessoryBtnText: { color: '#fff', fontWeight: '700' },
  androidDoneBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#4db3f4',
    alignItems: 'center',
    paddingVertical: 6,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '86%',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modalCardLarge: {
    width: '86%',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee', width: '100%' },
  modalItemText: { fontSize: 15, color: '#111827', textAlign: 'center' },
  modalClose: { paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { color: '#4db3f4', fontWeight: '700' },

  // Adresse Modal
  addrContainer: { flex: 1, backgroundColor: '#151a20' },
  addrHeader: {
    paddingTop: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addrTitle: { color: '#e5e7eb', fontSize: 20, fontWeight: '800' },
  addrCancel: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#222832',
    borderRadius: 20,
  },
  addrCancelText: { color: '#e5e7eb', fontWeight: '700' },
  addrInput: {
    backgroundColor: '#222832',
    borderColor: '#3b4452',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#e5e7eb',
    fontSize: 16,
  },
  addrCurrent: {
    marginTop: 14,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#2a6fdd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addrCurrentText: { color: '#fff', fontWeight: '700' },
  addrItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1d242e',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  addrItemText: { color: '#e5e7eb', flex: 1 },
});
