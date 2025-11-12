// screens/EmployerProfileEditScreen.js
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabaseClient';

const STORAGE_BUCKET = 'avatars';
const AVATAR_PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

// helper: base64 -> Uint8Array
function base64ToUint8Array(base64) {
  const binary = global.atob ? global.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function EmployerProfileEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const sessionFromParams = route?.params?.session ?? null;

  const [session, setSession] = useState(sessionFromParams);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Deutschland');

  // Vorschau
  const [localPreview, setLocalPreview] = useState(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!session) {
          const { data } = await supabase.auth.getSession();
          if (data?.session) setSession(data.session);
        }
      } catch (e) {
        console.warn(e);
      }
    })();
  }, []);

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
        company_name,
        company_slogan,
        company_description,
        industry,
        employee_count,
        address_street,
        address_zip,
        address_city,
        address_country
      `)
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error(error);
      Alert.alert('Fehler', 'Profil konnte nicht geladen werden.');
    } else if (data) {
      setAvatarUrl(data.avatar_url || null);
      setCompanyName(data.company_name || '');
      setSlogan(data.company_slogan || '');
      setDescription(data.company_description || '');
      setIndustry(data.industry || '');
      setEmployeeCount((data.employee_count ?? '').toString());
      setStreet(data.address_street || '');
      setZip(data.address_zip || '');
      setCity(data.address_city || '');
      setCountry(data.address_country || 'Deutschland');
    }
    setLoading(false);
  }

  async function pickImage() {
    try {
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

        // lokale Vorschau
        setLocalPreview(asset.uri);
        setPreviewBroken(false);

        // Upload
        const uploaded = await uploadToSupabase(asset);
        if (uploaded?.publicUrl) setAvatarUrl(uploaded.publicUrl);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Upload fehlgeschlagen', 'Das Bild konnte nicht hochgeladen werden.');
    }
  }

  // *** FIXED UPLOAD: Expo FileSystem Base64 -> Uint8Array ***
  async function uploadToSupabase(asset) {
    try {
      if (!session?.user?.id) {
        Alert.alert('Fehler', 'Keine gültige Session – bitte erneut einloggen.');
        return null;
      }

      const uri = asset.uri;
      // Metadaten
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      if (!info.exists) {
        Alert.alert('Fehler', 'Datei existiert nicht.');
        return null;
      }

      // robustes MIME + Extension
      const mime = asset.mimeType || (uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      const ext =
        mime === 'image/png'
          ? 'png'
          : mime === 'image/webp'
          ? 'webp'
          : 'jpg';

      // Datei als Base64 lesen
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!base64 || base64.length === 0) {
        Alert.alert('Fehler', 'Bilddaten leer (0 Bytes).');
        return null;
      }

      // In Binärdaten konvertieren
      const bytes = base64ToUint8Array(base64);

      // Zielpfad
      const filePath = `employers/${session.user.id}_${Date.now()}.${ext}`;

      // Upload als Uint8Array (Binary)
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, bytes, {
          upsert: true,
          contentType: mime,
        });

      if (uploadErr) {
        if (uploadErr.message?.toLowerCase().includes('bucket not found')) {
          Alert.alert(
            'Bucket nicht gefunden',
            `Der Storage-Bucket "${STORAGE_BUCKET}" existiert nicht oder der Name stimmt nicht.`
          );
        }
        throw uploadErr;
      }

      // Public URL erzeugen
      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
      const publicUrl = pub?.publicUrl || null;

      // in profiles speichern
      const { data: saved, error: upErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id: session.user.id,
            role: 'employer',
            avatar_url: publicUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('id, avatar_url')
        .single();

      if (upErr) console.warn('Avatar-URL konnte nicht gespeichert werden', upErr);

      setAvatarUrl(saved?.avatar_url ?? publicUrl);
      return { publicUrl };
    } catch (e) {
      console.error('uploadToSupabase error', e);
      throw e;
    }
  }

  function infoPopup(title, message) {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }

  async function onSave() {
    if (!companyName.trim()) {
      Alert.alert('Hinweis', 'Bitte gib einen Firmennamen ein.');
      return;
    }
    if (!session?.user?.id) {
      Alert.alert('Fehler', 'Keine gültige Session – bitte erneut einloggen.');
      return;
    }

    setSaving(true);

    const updates = {
      id: session.user.id,
      role: 'employer',
      avatar_url: avatarUrl || null,
      company_name: companyName.trim(),
      company_slogan: slogan.trim(),
      company_description: description.trim(),
      industry: industry.trim(),
      employee_count: employeeCount ? Number(employeeCount) : null,
      address_street: street.trim(),
      address_zip: zip.trim(),
      address_city: city.trim(),
      address_country: country.trim(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(updates, { onConflict: 'id' })
      .select('id, avatar_url')
      .single();

    setSaving(false);

    if (error) {
      console.error('onSave upsert error', error);
      Alert.alert('Fehler', 'Änderungen konnten nicht gespeichert werden.');
      return;
    }

    if (!data?.avatar_url) {
      Alert.alert(
        'Hinweis',
        'Profil gespeichert, aber avatar_url ist leer. Prüfe Policies von "profiles" oder ob ein Trigger den Wert überschreibt.'
      );
    } else {
      setAvatarUrl(data.avatar_url);
    }

    Alert.alert('Gespeichert', 'Dein Profil wurde aktualisiert.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
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
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil bearbeiten</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4db3f4" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Avatar/Logo */}
            <View style={styles.avatarRow}>
              <TouchableOpacity style={styles.avatarButton} onPress={pickImage}>
                <Image
                  source={{ uri: previewUri }}
                  style={styles.avatar}
                  onError={() => setPreviewBroken(true)}
                />
                <Text style={styles.avatarHint}>Logo ändern</Text>
              </TouchableOpacity>
              <Text style={styles.smallInfo}>Tipp: Quadratisches Logo (1:1) wirkt am besten.</Text>
            </View>

            {/* Firma */}
            <Field label="Firmenname">
              <TextInput
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="z. B. TechSolutions GmbH"
                placeholderTextColor="#9aa3ad"
                style={styles.input}
                returnKeyType="next"
              />
            </Field>

            {/* Slogan + Info */}
            <LabelWithInfo
              label="Slogan"
              onInfo={() =>
                infoPopup(
                  'Hinweis zum Slogan',
                  'Ein kurzer, prägnanter Claim (max. 8–10 Wörter), der eure Kultur/Benefits transportiert, kommt bei Bewerbern am besten an.'
                )
              }
            />
            <TextInput
              value={slogan}
              onChangeText={setSlogan}
              placeholder="Kurzer Claim"
              placeholderTextColor="#9aa3ad"
              style={styles.input}
              returnKeyType="next"
            />

            {/* Beschreibung + Info */}
            <LabelWithInfo
              label="Beschreibung"
              onInfo={() =>
                infoPopup(
                  'Hinweis zur Beschreibung',
                  'Beschreibe in 3–5 Sätzen, was ihr macht, euren Standort, eure Benefits und Arbeitsweise.'
                )
              }
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Was macht euer Unternehmen?"
              placeholderTextColor="#9aa3ad"
              multiline
              style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
            />

            <Field label="Branche">
              <TextInput
                value={industry}
                onChangeText={setIndustry}
                placeholder="z. B. IT, Gastronomie…"
                placeholderTextColor="#9aa3ad"
                style={styles.input}
                returnKeyType="next"
              />
            </Field>

            <Field label="Mitarbeiterzahl">
              <TextInput
                value={employeeCount}
                onChangeText={setEmployeeCount}
                placeholder="z. B. 25"
                placeholderTextColor="#9aa3ad"
                keyboardType="number-pad"
                style={styles.input}
                returnKeyType="done"
              />
            </Field>

            {/* Adresse */}
            <Text style={styles.sectionTitle}>Adresse</Text>
            <Field label="Straße & Nr.">
              <TextInput
                value={street}
                onChangeText={setStreet}
                placeholder="z. B. Musterstr. 12"
                placeholderTextColor="#9aa3ad"
                style={styles.input}
              />
            </Field>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="PLZ">
                  <TextInput
                    value={zip}
                    onChangeText={setZip}
                    placeholder="z. B. 80331"
                    placeholderTextColor="#9aa3ad"
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </Field>
              </View>
              <View style={{ flex: 2 }}>
                <Field label="Stadt">
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    placeholder="z. B. München"
                    placeholderTextColor="#9aa3ad"
                    style={styles.input}
                  />
                </Field>
              </View>
            </View>

            <Field label="Land">
              <TextInput
                value={country}
                onChangeText={setCountry}
                placeholder="z. B. Deutschland"
                placeholderTextColor="#9aa3ad"
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

/** Label-Komponenten */
function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function LabelWithInfo({ label, onInfo }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={onInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 6 }}>
        <Ionicons name="information-circle-outline" size={18} color="#4db3f4" />
      </TouchableOpacity>
    </View>
  );
}

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
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#4db3f4', textAlign: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarRow: { alignItems: 'center', marginBottom: 12 },
  avatarButton: { alignItems: 'center' },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eef2f7' },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  avatarHint: { marginTop: 8, color: '#4db3f4', fontWeight: '600' },
  smallInfo: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  sectionTitle: { marginTop: 12, marginBottom: 6, fontWeight: '700', color: '#111827' },
  label: { color: '#374151', fontWeight: '600' },
  labelRow: { marginTop: 14, marginBottom: 6, flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#4db3f4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },
});
