// screens/FeedbackScreen.js
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../supabaseClient';

const C = {
  bg: '#f7f8fb',
  white: '#fff',
  primary: '#4db3f4',
  text: '#0f172a',
  sub: '#64748b',
  line: '#e5e7eb',
};

export default function FeedbackScreen({ navigation, route }) {
  const session = route?.params?.session || null;
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!message.trim()) {
      Alert.alert('Hinweis', 'Bitte schreibe kurz dein Feedback.');
      return;
    }

    setSending(true);

    try {
      // 1) in Supabase-Table speichern (optional)
      await supabase.from('feedbacks').insert({
        user_id: session?.user?.id || null,
        message,
      });

      // 2) Edge Function aufrufen → E-Mail verschicken
      await supabase.functions.invoke('send-feedback-email', {
        body: {
          userId: session?.user?.id || null,
          email: session?.user?.email || null,
          message,
        },
      });

      Alert.alert('Danke 💙', 'Dein Feedback ist bei uns angekommen.');
      setMessage('');
      navigation.goBack();
    } catch (e) {
      console.log(e);
      Alert.alert('Fehler', 'Feedback konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.box}>
        <Text style={styles.label}>Was sollen wir besser machen?</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Schreib uns hier dein Feedback…"
          placeholderTextColor="#7a8594" 
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.button, sending && { opacity: 0.7 }]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Absenden</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  box: {
    backgroundColor: C.white,
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  label: { fontSize: 14, color: C.text, marginBottom: 8, fontWeight: '500' },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: C.text,
  },
  button: {
    backgroundColor: C.primary,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 14,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
