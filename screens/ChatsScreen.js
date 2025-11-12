import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Swipeable,
  GestureHandlerRootView
} from 'react-native-gesture-handler';
import { supabase } from '../supabaseClient';

export default function ChatsScreen({ route }) {
  const { session } = route.params;
  const navigation = useNavigation();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChats();
  }, []);

  async function fetchChats() {
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
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Laden der Chats:', error);
    } else {
      setChats(data ?? []);
    }
    setLoading(false);
  }

  async function deleteChat(chatId) {
    const { error } = await supabase.from('chats').delete().eq('id', chatId);
    if (error) {
      Alert.alert('Fehler beim Löschen');
    } else {
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    }
  }

  function renderRightActions(chatId) {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteChat(chatId)}
      >
        <Text style={styles.deleteText}>Löschen</Text>
      </TouchableOpacity>
    );
  }

  function renderItem({ item }) {
    const otherUser = item.partner ?? {};

    return (
      <Swipeable renderRightActions={() => renderRightActions(item.id)}>
        <TouchableOpacity
          style={styles.chatContainer}
         onPress={() =>
  navigation.navigate('ChatDetail', {
    chatId: item.id,
   session,
    partner: otherUser // hier übergeben wir es!
  })
}

        >
          <Image
            source={{
              uri: otherUser.avatar_url || 'https://via.placeholder.com/100'
            }}
            style={styles.avatar}
          />
          <View style={styles.chatInfo}>
            <Text style={styles.name}>
              {otherUser.first_name || ''} {otherUser.last_name || ''}
            </Text>
            <Text
               style={[styles.message, !item.is_read && styles.unread]} 
              numberOfLines={1}
            >
              {item.last_message || 'Keine Nachricht'}
            </Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>jatch</Text>
        </View>

        {loading ? (
          <Text style={styles.infoText}>Lade Chats...</Text>
        ) : chats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.infoText}>
              Du hast bisher noch keine Chats
            </Text>
          </View>
        ) : (
          <FlatList
            data={chats}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2'
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4db3f4'
  },
  chatContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  marginHorizontal: 16,
  marginVertical: 8,
  backgroundColor: '#fff',
  borderRadius: 12,

  // Schatten für iOS
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,

  // Schatten für Android
  elevation: 3,
},

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12
  },
  chatInfo: {
    flex: 1
  },
  name: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  message: {
    fontSize: 14,
    color: '#4db3f4',
    marginTop: 4
  },
  unread: {
    fontWeight: 'bold',
    color: '#4db3f4'
  },
  deleteButton: {
  backgroundColor: 'red',
  justifyContent: 'center',
  alignItems: 'flex-end',
  paddingHorizontal: 20,
  borderRadius: 12,
  marginVertical: 8,
  marginRight: 16,

  // iOS Schatten
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,

  // Android Schatten
  elevation: 4,
},

  deleteText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  infoText: {
    color: '#888',
    fontSize: 16,
    marginTop: 20
  }
});
