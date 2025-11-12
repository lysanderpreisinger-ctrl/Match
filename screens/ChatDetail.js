// screens/ChatDetail.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../supabaseClient';
import { useLang } from '../LanguageContext';

const CHAT_BUCKET = 'chat-uploads'; // <--- ggf. in Supabase so anlegen

export default function ChatDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLang();

  // Eingehende Params
  const paramChatId = route?.params?.chatId ?? null;
  const paramMatchId = route?.params?.matchId ?? null;
  const paramSession = route?.params?.session ?? null;
  const paramPartner = route?.params?.partner ?? null; // { id, first_name, last_name, avatar_url, role? }
  const otherUser = route?.params?.otherUser ?? null; // { id, name, avatar, role? }
  const role = (route?.params?.role || '').toLowerCase(); // 'employer' | 'employee'

  // Session
  const [session, setSession] = useState(paramSession);
  const currentUserId = session?.user?.id ?? null;

  // Chat / Match
  const [chatId, setChatId] = useState(paramChatId);
  const [matchId, setMatchId] = useState(paramMatchId);

  // Freischalten
  const [unlocked, setUnlocked] = useState(true);
  const [checkingUnlock, setCheckingUnlock] = useState(
    !!paramMatchId && role === 'employee'
  );

  // Messages
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [booting, setBooting] = useState(true);
  const [uploading, setUploading] = useState(false);

  const flatListRef = useRef(null);
  const channelRef = useRef(null);

  // -----------------------------------
  // 1) Session nachladen, wenn nicht da
  // -----------------------------------
  useEffect(() => {
    if (session) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session ?? null);
    })();
  }, [session]);

  // -----------------------------------
  // 2) Chat-ID sicherstellen
  // -----------------------------------
  useEffect(() => {
    if (!session?.user?.id) return;

    (async () => {
      try {
        if (chatId) {
          setBooting(false);
          return;
        }

        // Chat aus match ableiten
        if (!chatId && matchId) {
          // Chat zu diesem Match vorhanden?
          const { data: existing } = await supabase
            .from('chats')
            .select('id')
            .eq('match_id', matchId)
            .maybeSingle();

          if (existing?.id) {
            setChatId(existing.id);
            setBooting(false);
            return;
          }

          // Match laden
          const { data: m, error: mErr } = await supabase
            .from('matches')
            .select(
              'employer_id, employee_id, employer_unlocked, employer_payment_status'
            )
            .eq('id', matchId)
            .single();

          if (mErr) {
            console.warn('match fetch error', mErr);
            setBooting(false);
            return;
          }

          // Employee: prüfen, ob freigeschaltet
          if (role === 'employee') {
            const isUnlocked = !!(
              m.employer_unlocked ||
              m.employer_payment_status === 'paid' ||
              m.employer_payment_status === 'free'
            );
            setUnlocked(isUnlocked);
            setCheckingUnlock(false);
          }

          // Chat anlegen
          const { data: inserted, error: insErr } = await supabase
            .from('chats')
            .insert({
              match_id: matchId,
              employer_id: m.employer_id,
              employee_id: m.employee_id,
            })
            .select('id')
            .single();

          if (insErr) {
            console.warn('chat insert error', insErr);
            setBooting(false);
            return;
          }

          setChatId(inserted.id);
          setBooting(false);
          return;
        }

        // Kein chat, kein match
        setBooting(false);
      } catch (e) {
        console.warn('ensure chat failed', e);
        setBooting(false);
      }
    })();
  }, [session?.user?.id, chatId, matchId, role]);

  // -----------------------------------
  // 3) Unlock für Employee prüfen
  // -----------------------------------
  useEffect(() => {
    if (role !== 'employee' || !matchId) return;
    (async () => {
      try {
        const { data: m } = await supabase
          .from('matches')
          .select('employer_unlocked, employer_payment_status')
          .eq('id', matchId)
          .single();

        if (m) {
          const isUnlocked = !!(
            m.employer_unlocked ||
            m.employer_payment_status === 'paid' ||
            m.employer_payment_status === 'free'
          );
          setUnlocked(isUnlocked);
        }
      } finally {
        setCheckingUnlock(false);
      }
    })();
  }, [role, matchId]);

  // -----------------------------------
  // 4) Nachrichten + Realtime
  // -----------------------------------
  useEffect(() => {
    if (!chatId) return;

    let channel;
    (async () => {
      // initial load
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, type, file_url, file_name')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (!error) setMessages(data ?? []);

      // realtime
      channel = supabase
        .channel(`chat-${chatId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => {
            const msg = payload.new;
            setMessages((prev) => [...prev, msg]);
            requestAnimationFrame(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            });
          }
        )
        .subscribe();
      channelRef.current = channel;
    })();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [chatId]);

  // -----------------------------------
  // 5) Header-Daten
  // -----------------------------------
  const partnerId =
    otherUser?.id || paramPartner?.id || route?.params?.otherUserId || null;

  const headerAvatar = useMemo(() => {
    return (
      otherUser?.avatar ||
      paramPartner?.avatar_url ||
      'https://via.placeholder.com/100'
    );
  }, [otherUser?.avatar, paramPartner?.avatar_url]);

  const headerName = useMemo(() => {
    if (otherUser?.name) return otherUser.name;
    const name = [paramPartner?.first_name, paramPartner?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    return name || t('chats.chat') || 'Chat';
  }, [otherUser?.name, paramPartner?.first_name, paramPartner?.last_name, t]);

  // -----------------------------------
  // 6) Nachricht senden (Text)
  // -----------------------------------
  async function sendMessage() {
    if (!newMessage.trim() || !chatId || !currentUserId) return;

    const text = String(newMessage.trim());
    setNewMessage('');

    const { error } = await supabase.from('messages').insert([
      {
        chat_id: chatId,
        sender_id: currentUserId,
        content: text,
        type: 'text',
      },
    ]);

    if (error) {
      console.error('Fehler beim Senden:', error);
    }
  }

  // -----------------------------------
  // 7) Medien senden
  // -----------------------------------
  async function openAttachmentMenu() {
    Alert.alert(
      t('chats.attach') || 'Anhängen',
      t('chats.attachDesc') || 'Was möchtest du senden?',
      [
        {
          text: t('chats.photo') || 'Foto aufnehmen',
          onPress: pickCamera,
        },
        {
          text: t('chats.gallery') || 'Aus Galerie',
          onPress: pickGallery,
        },
        {
          text: t('chats.document') || 'Dokument',
          onPress: pickDocument,
        },
        {
          text: t('chats.cancel') || 'Abbrechen',
          style: 'cancel',
        },
      ]
    );
  }

  async function pickCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Kamera', 'Kamerazugriff nicht erlaubt.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      await uploadAndSendFile(asset.uri, 'image', asset.fileName || 'photo.jpg');
    }
  }

  async function pickGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Bilder', 'Zugriff nicht erlaubt.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      await uploadAndSendFile(asset.uri, 'image', asset.fileName || 'image.jpg');
    }
  }

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: false,
    });
    if (res.canceled) return;
    const file = res.assets?.[0];
    if (!file) return;
    await uploadAndSendFile(file.uri, 'document', file.name || 'document');
  }

  async function uploadAndSendFile(uri, fileType = 'image', fileName = 'file') {
    if (!chatId || !currentUserId) return;
    try {
      setUploading(true);

      // Datei in Supabase hochladen
      const fileExt = fileName.split('.').pop();
      const path = `${chatId}/${Date.now()}.${fileExt || 'bin'}`;

      const fileRes = await fetch(uri);
      const fileBlob = await fileRes.blob();

      const { error: uploadError } = await supabase.storage
        .from(CHAT_BUCKET)
        .upload(path, fileBlob, {
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        Alert.alert('Upload fehlgeschlagen', uploadError.message);
        return;
      }

      // Public URL holen
      const { data: publicData } = supabase.storage
        .from(CHAT_BUCKET)
        .getPublicUrl(path);

      const publicUrl = publicData?.publicUrl;

      // Nachricht in DB
      const { error: msgErr } = await supabase.from('messages').insert([
        {
          chat_id: chatId,
          sender_id: currentUserId,
          content:
            fileType === 'image'
              ? (t('chats.sentImage') || 'Bild gesendet')
              : (t('chats.sentFile') || 'Datei gesendet'),
          type: fileType,
          file_url: publicUrl,
          file_name: fileName,
        },
      ]);

      if (msgErr) {
        console.error(msgErr);
      }
    } finally {
      setUploading(false);
    }
  }

  // -----------------------------------
  // 8) Profil öffnen
  // -----------------------------------
  function openPartnerProfile() {
    if (!partnerId) return;

    // wir raten hier: wenn ICH employer bin, schaue ich employee an → EmployeeProfileView
    // andersrum: employer profile
    if (role === 'employer') {
      navigation.navigate('EmployeeProfileViewScreen', {
        profileId: partnerId,
      });
    } else {
      navigation.navigate('ProfileDetailsScreen', {
        profileId: partnerId,
      });
    }
  }

  // -----------------------------------
  // 9) Message-Render (Text / Bild / Doku)
  // -----------------------------------
  const renderItem = ({ item }) => {
    const isOwn = item.sender_id === currentUserId;
    const time =
      item?.created_at
        ? new Date(item.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
    const type = item?.type || 'text';

    return (
      <View
        style={[
          styles.messageContainer,
          isOwn ? styles.ownMessage : styles.theirMessage,
        ]}
      >
        {type === 'image' && item.file_url ? (
          <Image
            source={{ uri: item.file_url }}
            style={styles.imageMsg}
            resizeMode="cover"
          />
        ) : type === 'document' ? (
          <TouchableOpacity
            onPress={() => {
              // hier könntest du ein Linking.openURL(item.file_url) machen
              Alert.alert('Dokument', 'Download: ' + (item.file_name || 'Dokument'));
            }}
            style={styles.docMsg}
          >
            <Ionicons name="document-outline" size={20} color="#fff" />
            <Text style={styles.docText}>
              {item.file_name || t('chats.document') || 'Dokument'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.messageText, isOwn ? { color: '#fff' } : { color: '#111827' }]}>
            {item.content}
          </Text>
        )}

        <Text style={[styles.timestamp, isOwn ? { color: '#e8f4ff' } : { color: '#6b7280' }]}>
          {time}
        </Text>
      </View>
    );
  };

  // -----------------------------------
  // 10) Loading
  // -----------------------------------
  if (booting || !session || (role === 'employee' && checkingUnlock)) {
    return (
      <SafeAreaView style={styles.wrapper}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#4db3f4" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.userInfo} onPress={openPartnerProfile}>
            <Image source={{ uri: headerAvatar }} style={styles.avatar} />
            <Text style={styles.headerTitle}>{headerName}</Text>
          </TouchableOpacity>

          <View style={{ width: 24 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4db3f4" />
        </View>
      </SafeAreaView>
    );
  }

  const inputDisabled = role === 'employee' && !unlocked;

  // -----------------------------------
  // 11) UI
  // -----------------------------------
  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#4db3f4" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.userInfo} onPress={openPartnerProfile}>
          <Image source={{ uri: headerAvatar }} style={styles.avatar} />
          <Text style={styles.headerTitle}>{headerName}</Text>
        </TouchableOpacity>

        <View style={{ width: 24 }} />
      </View>

      {/* Hinweis-Banner, wenn noch nicht freigeschaltet (nur Employee) */}
      {role === 'employee' && !unlocked && (
        <View style={styles.infoBar}>
          <Ionicons name="information-circle-outline" size={18} color="#4db3f4" />
          <Text style={styles.infoText}>
            {t('chats.locked') ||
              'Dein Match ist fast bereit ✨ – sobald der Arbeitgeber freigibt, könnt ihr schreiben.'}
          </Text>
        </View>
      )}

      {/* Nachrichtenliste mit Hintergrund */}
      <View style={styles.chatBg}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item?.id?.toString() ?? index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      </View>

      {/* Eingabe */}
      <View style={[styles.inputContainer, inputDisabled && { opacity: 0.5 }]}>
        {/* Attachment */}
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={openAttachmentMenu}
          disabled={inputDisabled}
        >
          <Ionicons name="add" size={22} color="#4db3f4" />
        </TouchableOpacity>

        <TextInput
          placeholder={
            inputDisabled
              ? (t('chats.waiting') || 'Warte auf Bestätigung …')
              : (t('chats.placeholder') || 'Nachricht schreiben …')
          }
          value={newMessage}
          onChangeText={setNewMessage}
          style={styles.input}
          editable={!inputDisabled}
        />

        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendMessage}
          disabled={inputDisabled || !newMessage.trim()}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ------------------ STYLES ------------------
const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ccc',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4db3f4',
    marginLeft: 8,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    margin: 12,
    backgroundColor: '#e6f2fb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7eafc',
  },
  infoText: { flex: 1, color: '#374151', fontSize: 13 },
  chatBg: {
    flex: 1,
    // kleiner „Match“-Verlauf
    backgroundColor: '#f6fbff',
  },
  chatContent: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageContainer: {
    maxWidth: '75%',
    marginVertical: 6,
    padding: 10,
    borderRadius: 14,
  },
  ownMessage: {
    backgroundColor: '#4db3f4',
    alignSelf: 'flex-end',
  },
  theirMessage: {
    backgroundColor: '#ffffffcc',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e2ebf3',
  },
  messageText: {
    fontSize: 15,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    backgroundColor: '#eaf6ff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#4db3f4',
    borderRadius: 20,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageMsg: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#d9e6ff',
  },
  docMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docText: {
    color: '#fff',
    fontWeight: '600',
  },
});
