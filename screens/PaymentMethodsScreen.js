// screens/PaymentMethodsScreen.js
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const C = {
  bg: '#f7f8fb',
  white: '#fff',
  primary: '#4db3f4',
  text: '#0f172a',
  sub: '#64748b',
};

export default function PaymentMethodsScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bezahlmethode</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.info}>
          Hier kannst du später deine gespeicherten Zahlungsmittel aus Stripe anzeigen,
          neue hinzufügen oder löschen.
        </Text>
        <Text style={styles.infoSmall}>
          (Wir haben Stripe ja schon eingebunden 😉)
        </Text>
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
  body: { padding: 16 },
  info: { color: C.text, fontSize: 15, marginBottom: 4 },
  infoSmall: { color: C.sub, fontSize: 13 },
});
