// screens/ResumeDocumentsScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';

const ACCENT = '#4db3f4';
const BUCKET = 'documents';

export default function ResumeDocumentsScreen() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    })();
  }, []);

  const listDocs = useCallback(async (uid) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).list(uid || user?.id, {
        limit: 100,
        sortBy: { column: 'updated_at', order: 'desc' },
      });
      if (error) throw error;

      const enriched = (data || []).map((f) => {
        const path = `${uid || user?.id}/${f.name}`;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return { name: f.name, path, url: pub.publicUrl, updatedAt: f.updated_at || f.created_at };
      });
      setItems(enriched);
    } catch (e) {
      Alert.alert('Fehler beim Laden', e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) listDocs(user.id);
  }, [user, listDocs]);

  const pickAndUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;

      const file = res.assets[0];
      setUploading(true);

      // Datei in Blob umwandeln (Expo)
      const r = await fetch(file.uri);
      const blob = await r.blob();

      const safeName = `${Date.now()}-${file.name?.replace(/\s+/g, '_') || 'document.pdf'}`;
      const path = `${user.id}/${safeName}`;

      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (error) throw error;

      await listDocs(user.id);
      Alert.alert('Hochgeladen', 'Dein Dokument wurde gespeichert.');
    } catch (e) {
      Alert.alert('Upload fehlgeschlagen', e.message);
    } finally {
      setUploading(false);
    }
  };

  const openDoc = async (item) => {
    try {
      await WebBrowser.openBrowserAsync(item.url);
    } catch (e) {
      Alert.alert('Konnte Dokument nicht öffnen', e.message);
    }
  };

  const removeDoc = (item) => {
    Alert.alert('Löschen?', `${item.name} wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.storage.from(BUCKET).remove([item.path]);
            if (error) throw error;
            setItems((prev) => prev.filter((x) => x.path !== item.path));
          } catch (e) {
            Alert.alert('Fehler beim Löschen', e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lebenslauf & Dokumente</Text>

      <TouchableOpacity style={styles.primaryBtn} onPress={pickAndUpload} disabled={uploading || !user}>
        <Text style={styles.primaryBtnText}>{uploading ? 'Lade hoch...' : 'PDF hochladen'}</Text>
      </TouchableOpacity>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Lade deinen aktuellen Lebenslauf (PDF) hoch. Du kannst mehrere Dateien speichern (z. B. Zeugnisse, Zertifikate).
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>Noch keine Dokumente hochgeladen.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.path}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName}>{item.name}</Text>
                <Text style={styles.fileMeta}>aktualisiert: {new Date(item.updatedAt || Date.now()).toLocaleString()}</Text>
              </View>
              <TouchableOpacity onPress={() => openDoc(item)} style={styles.linkBtn}>
                <Text style={styles.link}>Ansehen</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeDoc(item)} style={styles.linkBtn}>
                <Text style={[styles.link, { color: '#d9534f' }]}>Löschen</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  primaryBtn: { backgroundColor: ACCENT, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { backgroundColor: '#eef7ff', padding: 12, borderRadius: 10, marginTop: 12 },
  hintText: { color: '#3b6a8b' },
  empty: { marginTop: 16, color: '#666' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  fileName: { fontWeight: '600' },
  fileMeta: { color: '#777', marginTop: 2 },
  linkBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  link: { color: ACCENT, fontWeight: '700' },
});
