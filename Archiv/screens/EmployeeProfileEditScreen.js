// screens/EmployeeProfileEditScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  FlatList,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabaseClient';

const STORAGE_BUCKET = 'avatars';
const AVATAR_PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

const ACCENT = '#4db3f4';
const SUGGESTED_SKILLS = [
  'Kundenservice', 'Teamarbeit', 'Kommunikation', 'Verkauf',
  'Excel', 'Organisation', 'JavaScript', 'React', 'React Native',
  'MS Office', 'Buchhaltung', 'Marketing', 'Gastronomie', 'Logistik'
];

// ---------- Helpers ----------
function base64ToUint8Array(base64) {
  const binary = global.atob
    ? global.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Einfache Select/Dropdown per Modal (ohne zusätzliche Libraries)
function SelectField({ label, value, placeholder, options, onSelect }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.selectBox}
        activeOpacity={0.85}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.selectText, !value && { color: '#5f6b76' }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(it) => it}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item}</Text>
                  {value === item && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function EmployeeProfileEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const sessionFromParams = route?.params?.session ?? null;

  const [session, setSession] = useState(sessionFromParams);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---- Form state ----
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]  = useState('');
  const [description, setDescription] = useState(''); // Über mich

  // NEU: Skills als Array + Eingabefeld
  const [skillsArr, setSkillsArr] = useState([]);
  const [skillInput, setSkillInput] = useState('');

  const [qualification, setQualification] = useState('');
  const [germanLevel, setGermanLevel] = useState('');
  const [englishLevel, setEnglishLevel] = useState('');
  const [experience, setExperience] = useState(''); // optional: Jahre
  const [hasDL, setHasDL] = useState(false); // Führerschein
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Deutschland');

  // Vorschau
  const [localPreview, setLocalPreview] = useState(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  // ---- Options ----
  const QUALIFICATIONS = [
    'Kein Abschluss',
    'Hauptschule',
    'Realschule',
    'Fachabitur',
    'Abitur',
    'Bachelor',
    'Master',
    'Doktor',
  ];
  const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Muttersprache'];

  // ---- Session laden ----
  useEffect(() => {
    (async () => {
      if (!session) {
        const { data } = await supabase.auth.getSession();
        if (data?.session) setSession(data.session);
      }
    })();
  }, []);

  // ---- Profil laden ----
  useEffect(() => {
    if (session?.user?.id) loadProfile();
  }, [session?.user?.id]);

  async function loadProfile() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        avatar_url,
        first_name,
        last_name,
        bio,
        skills,
        qualification,
        german_level,
        english_level,
        experience,
        has_drivers_license,
        address_city,
        address_country
      `)
      .eq('id', session.user.id)
      .single();

    if (error) {
      Alert.alert('Fehler', 'Profil konnte nicht geladen werden.');
    } else if (data) {
      setAvatarUrl(data.avatar_url || null);
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setDescription(data.bio || '');

      // Skills robust ins Array bringen
      if (Array.isArray(data.skills)) {
        setSkillsArr(data.skills.filter(Boolean));
      } else if (typeof data.skills === 'string') {
        setSkillsArr(
          data.skills.split(',').map(s => s.trim()).filter(Boolean)
        );
      } else {
        setSkillsArr([]);
      }

      setQualification(data.qualification || '');
      setGermanLevel(data.german_level || '');
      setEnglishLevel(data.english_level || '');
      setExperience(
        typeof data.experience === 'number' ? String(data.experience) : (data.experience || '')
      );
      setHasDL(Boolean(data.has_drivers_license));
      setCity(data.address_city || '');
      setCountry(data.address_country || 'Deutschland');
    }
    setLoading(false);
  }

  // ---- Avatar wählen & hochladen ----
  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Zugriff auf deine Fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setLocalPreview(asset.uri);
      setPreviewBroken(false);

      const uploaded = await uploadToSupabase(asset);
      if (uploaded?.publicUrl) setAvatarUrl(uploaded.publicUrl);
    }
  }

  async function uploadToSupabase(asset) {
    try {
      if (!session?.user?.id) return null;
      const uri = asset.uri;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return null;

      const mime =
        asset.mimeType ||
        (uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      const ext = mime.split('/')[1] || 'jpg';

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) return null;

      const bytes = base64ToUint8Array(base64);
      const filePath = `employees/${session.user.id}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, bytes, {
          upsert: true,
          contentType: mime,
        });

      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);
      const publicUrl = pub?.publicUrl || null;

      await supabase
        .from('profiles')
        .upsert({ id: session.user.id, avatar_url: publicUrl }, { onConflict: 'id' });

      return { publicUrl };
    } catch (e) {
      console.error(e);
      Alert.alert('Fehler', 'Upload fehlgeschlagen.');
      return null;
    }
  }

  function infoPopup(title, message) {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }

  // ---- Skills Logik (Chips) ----
  const addSkill = (text) => {
    const t = (text || '').trim();
    if (!t) return;
    if (skillsArr.includes(t)) return;
    setSkillsArr([...skillsArr, t]);
    setSkillInput('');
  };
  const removeSkill = (s) => setSkillsArr(skillsArr.filter((x) => x !== s));

  async function onSave() {
    if (!session?.user?.id) {
      Alert.alert('Fehler', 'Keine gültige Session – bitte erneut einloggen.');
      return;
    }

    setSaving(true);

    const numExp =
      typeof experience === 'number'
        ? experience
        : experience && !isNaN(Number(experience))
        ? Number(experience)
        : null;

    const updates = {
      id: session.user.id,
      role: 'employee',
      avatar_url: avatarUrl || null,
      first_name: (firstName || '').trim() || null,
      last_name: (lastName || '').trim() || null,
      bio: (description || '').trim() || null,
      skills: skillsArr,                        // <-- jetzt Array
      qualification: qualification || null,
      german_level: germanLevel || null,
      english_level: englishLevel || null,
      experience: numExp,
      has_drivers_license: Boolean(hasDL),
      address_city: (city || '').trim() || null,
      address_country: (country || '').trim() || null,
      updated_at: new Date().toISOString(),
    };

    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', session.user.id)
        .select('id')
        .single();

      if (error) {
        console.error('profiles.update error:', error);
        Alert.alert('Speichern fehlgeschlagen', error.message || 'Änderungen konnten nicht gespeichert werden.');
        return;
      }

      Alert.alert('Gespeichert', 'Dein Profil wurde aktualisiert.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error('profiles.update exception:', e);
      Alert.alert('Speichern fehlgeschlagen', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  const previewUri =
    !previewBroken && (localPreview || avatarUrl)
      ? localPreview || avatarUrl
      : AVATAR_PLACEHOLDER;

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Zurück">
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil bearbeiten</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Avatar */}
            <View style={styles.avatarRow}>
              <TouchableOpacity onPress={pickImage} style={{ alignItems: 'center' }}>
                <Image source={{ uri: previewUri }} style={styles.avatar} onError={() => setPreviewBroken(true)} />
                <Text style={styles.avatarHint}>Foto ändern</Text>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Field label="Vorname">
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="z. B. Maria"
                placeholderTextColor="#5f6b76"
                style={styles.input}
                returnKeyType="next"
              />
            </Field>

            <Field label="Nachname">
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="z. B. Schneider"
                placeholderTextColor="#5f6b76"
                style={styles.input}
                returnKeyType="next"
              />
            </Field>

            {/* Über mich */}
            <View style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.label}>Über mich</Text>
              <TouchableOpacity
                onPress={() =>
                  infoPopup(
                    'Über mich – Tipp',
                    'Beschreibe dich in 3–5 Sätzen:\n• Ausbildung/Jobtitel & Erfahrung\n• Stärken/Skills\n• Was du suchst (Vollzeit/Teilzeit, Branche)'
                  )
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 6 }}
              >
                <Ionicons name="information-circle-outline" size={18} color={ACCENT} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Schreibe etwas über dich..."
              placeholderTextColor="#5f6b76"
              multiline
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
            />

            {/* Skills (Chips) */}
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.label}>Skills</Text>
                <TouchableOpacity
                  onPress={() =>
                    infoPopup(
                      'Skills – Tipp',
                      'Wähle 5–8 deiner wichtigsten Fähigkeiten. Tippe auf eine Empfehlung oder füge eigene Begriffe hinzu.'
                    )
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 6 }}
                >
                  <Ionicons name="information-circle-outline" size={18} color={ACCENT} />
                </TouchableOpacity>
              </View>

              {/* Vorhandene Skills */}
              <View style={styles.rowWrap}>
                {skillsArr.length === 0 ? (
                  <Text style={{ color: '#6b7280' }}>Noch keine Skills ausgewählt.</Text>
                ) : (
                  skillsArr.map((s) => (
                    <TouchableOpacity key={s} style={styles.chipActive} onPress={() => removeSkill(s)}>
                      <Text style={styles.chipActiveText}>✕ {s}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Eingabe + Button */}
              <View style={[styles.row, { marginTop: 8 }]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Eigenen Skill eingeben…"
                  placeholderTextColor="#5f6b76"
                  value={skillInput}
                  onChangeText={setSkillInput}
                  onSubmitEditing={() => addSkill(skillInput)}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addBtn} onPress={() => addSkill(skillInput)}>
                  <Text style={styles.addBtnText}>Hinzufügen</Text>
                </TouchableOpacity>
              </View>

              {/* Vorschläge */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
                {SUGGESTED_SKILLS.filter(s => !skillsArr.includes(s)).map((s) => (
                  <TouchableOpacity key={s} style={styles.chip} onPress={() => addSkill(s)}>
                    <Text style={styles.chipText}>+ {s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Dropdowns */}
            <SelectField
              label="Schulabschluss"
              value={qualification}
              placeholder="Bitte auswählen"
              options={QUALIFICATIONS}
              onSelect={setQualification}
            />

            <SelectField
              label={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.label}>Deutsch-Niveau</Text>
                  <TouchableOpacity
                    onPress={() =>
                      infoPopup(
                        'Deutsch-Niveau einschätzen',
                        'A1–A2: Einfache Sätze und Grundlagen.\nB1–B2: Gute Verständigung, auch im Beruf.\nC1–C2: Sehr gutes bis nahezu muttersprachliches Niveau.\nMuttersprache: Deutsch ist deine erste Sprache.'
                      )
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 6 }}
                  >
                    <Ionicons name="information-circle-outline" size={18} color={ACCENT} />
                  </TouchableOpacity>
                </View>
              }
              value={germanLevel}
              placeholder="Bitte auswählen"
              options={CEFR}
              onSelect={setGermanLevel}
            />

            <SelectField
              label={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.label}>Englisch-Niveau</Text>
                  <TouchableOpacity
                    onPress={() =>
                      infoPopup(
                        'Englisch-Niveau einschätzen',
                        'A1–A2: Grundkenntnisse, einfache Gespräche.\nB1–B2: Gute Verständigung im Alltag und Beruf.\nC1–C2: Sehr gute bis nahezu muttersprachliche Kenntnisse.\nMuttersprache: Englisch ist deine erste Sprache.'
                      )
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 6 }}
                  >
                    <Ionicons name="information-circle-outline" size={18} color={ACCENT} />
                  </TouchableOpacity>
                </View>
              }
              value={englishLevel}
              placeholder="Bitte auswählen"
              options={CEFR}
              onSelect={setEnglishLevel}
            />

            {/* Erfahrung & Führerschein */}
            <Field label="Berufserfahrung (Jahre, optional)">
              <TextInput
                value={experience}
                onChangeText={setExperience}
                placeholder="z. B. 3"
                placeholderTextColor="#5f6b76"
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>

            <View style={[styles.cardLine, { marginBottom: 10 }]}>
              <Text style={[styles.label, { marginBottom: 0 }]}>Führerschein</Text>
              <Switch value={hasDL} onValueChange={setHasDL} />
            </View>

            {/* Adresse */}
            <Field label="Stadt">
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="z. B. München"
                placeholderTextColor="#5f6b76"
                style={styles.input}
              />
            </Field>

            <Field label="Land">
              <TextInput
                value={country}
                onChangeText={setCountry}
                placeholder="z. B. Deutschland"
                placeholderTextColor="#5f6b76"
                style={styles.input}
              />
            </Field>

            {/* Speichern */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Änderungen speichern</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ---------- UI Helpers ----------
function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f8fb' },

  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: ACCENT },

  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  avatarRow: { alignItems: 'center', marginBottom: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#eef2f7' },
  avatarHint: { marginTop: 8, color: ACCENT, fontWeight: '600' },

  label: { color: '#374151', fontWeight: '600', marginBottom: 6 },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },

  // Select (Dropdown) Styles
  selectBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    color: '#111827',
    fontSize: 14,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 12,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#eef2f7',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontWeight: '700', color: '#111827', fontSize: 16 },
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: { color: '#111827', fontSize: 15 },
  separator: { height: 1, backgroundColor: '#f3f4f6' },

  cardLine: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Chips
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ACCENT,
    marginRight: 8,
    marginTop: 6,
    backgroundColor: '#fff',
  },
  chipText: { color: '#0b1a2b', fontWeight: '700' },
  chipActive: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: ACCENT,
    marginRight: 8,
    marginTop: 6,
  },
  chipActiveText: { color: '#fff', fontWeight: '700' },
  addBtn: { backgroundColor: ACCENT, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700' },

  saveBtn: {
    marginTop: 16,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },
});
