// screens/RoleSelectScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const APP_BLUE = '#4db3f4';

export default function RoleSelectScreen() {
  const navigation = useNavigation();
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!selectedRole) {
      Alert.alert('Bitte Rolle wählen', 'Wähle Arbeitnehmer oder Arbeitgeber aus.');
      return;
    }
    setLoading(true);
    try {
      // NICHT speichern! Nur Rolle an nächste Seite weitergeben
      navigation.navigate('NotificationConsentScreen', { role: selectedRole });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Zurück" style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={APP_BLUE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rolle auswählen</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Inhalt mittig */}
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Wählen Sie Ihre Rolle</Text>
          <Text style={styles.subtitle}>
            Bitte wählen Sie aus, ob Sie Arbeitnehmer oder Arbeitgeber sind.
          </Text>

          <RoleOption
            title="Arbeitnehmer"
            icon="person-outline"
            selected={selectedRole === 'employee'}
            onPress={() => setSelectedRole('employee')}
          />
          <RoleOption
            title="Arbeitgeber"
            icon="briefcase-outline"
            selected={selectedRole === 'employer'}
            onPress={() => setSelectedRole('employer')}
          />

          <TouchableOpacity
            style={[styles.primaryButton, !selectedRole && { opacity: 0.6 }]}
            disabled={!selectedRole || loading}
            onPress={handleNext}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Nächster Schritt</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function RoleOption({ title, icon, selected, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}
      style={[styles.roleCard, selected && styles.roleCardSelected]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name={icon} size={22} color="#333" />
        <Text style={styles.roleTitle}>{title}</Text>
      </View>
      <View style={[styles.radioOuter, selected && { borderColor: APP_BLUE }]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 6,              // etwas Abstand nach SafeArea
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_BLUE,            // App-Farbe
  },

  // Inhalt mittig ausrichten
  content: {
    flex: 1,
    justifyContent: 'center',   // vertikal zentriert
    paddingHorizontal: 16,
  },

  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },

  roleCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  roleCardSelected: { borderColor: APP_BLUE, backgroundColor: '#f6fbff' },
  roleTitle: { fontSize: 16, fontWeight: '600' },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: APP_BLUE },

  primaryButton: {
    backgroundColor: APP_BLUE,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
