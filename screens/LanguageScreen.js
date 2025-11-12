// screens/LanguageScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../supabaseClient';
import { useLang } from '../LanguageContext';

const C = {
  bg: '#f7f8fb',
  white: '#fff',
  primary: '#4db3f4',
  text: '#0f172a',
  sub: '#64748b',
};

export default function LanguageScreen({ navigation, route }) {
  const session = route?.params?.session || null;
  const { lang, setLang, t } = useLang();
  const [selected, setSelected] = useState(lang || 'de');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(lang);
  }, [lang]);

  async function persistLanguage(langCode) {
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ app_language: langCode })
      .eq('id', session.user.id);
    if (error) {
      Alert.alert('Fehler', error.message);
    }
  }

  async function onSelectLanguage(langCode) {
    // 1. sofort im Context ändern → UI wechselt
    setLang(langCode);
    setSelected(langCode);
  }

  async function onApply() {
    setSaving(true);
    try {
      // in DB speichern (wenn eingeloggt)
      await persistLanguage(selected);
      // kleine Meldung in richtiger Sprache
      Alert.alert(
        selected === 'de' ? 'Gespeichert' : 'Saved',
        selected === 'de'
          ? 'Die App wird jetzt auf Deutsch angezeigt.'
          : 'The app will now be shown in English.'
      );
      // zurück zu den Settings
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {selected === 'de' ? 'Sprache' : 'Language'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Sprachliste */}
      <View style={styles.list}>
        <LangRow
          label="Deutsch"
          active={selected === 'de'}
          onPress={() => onSelectLanguage('de')}
        />
        <LangRow
          label="English"
          active={selected === 'en'}
          onPress={() => onSelectLanguage('en')}
        />
      </View>

      {/* Übernehmen-Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.applyBtn, saving && { opacity: 0.6 }]}
          onPress={onApply}
          disabled={saving}
        >
          <Text style={styles.applyText}>
            {selected === 'de' ? 'Sprache übernehmen' : 'Apply language'}
          </Text>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function LangRow({ label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowText}>{label}</Text>
      {active ? <Ionicons name="checkmark-circle" size={22} color={C.primary} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.white,
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.primary },
  list: {
    backgroundColor: C.white,
    margin: 16,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  rowText: { fontSize: 15, color: C.text },
  footer: {
    marginTop: 'auto',
    padding: 16,
  },
  applyBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
