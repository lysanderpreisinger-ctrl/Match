import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Pressable,
  Button,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '../lib/supabase';

const employmentForms = [
  'Teilzeit',
  'Vollzeit',
  'Minijob',
  
];

const employmentTypes = [
  'Aushilfe / Nebenjob',
  'Berufseinsteiger',
  'Führungskraft',
  'Ausbildung',
  'Praktikum',
  'Werkstudent/in',
  'Freelancer',
  'Selbstständige Tätigkeit',
];

export default function FilterScreen() {
  const user = useUser();
  const navigation = useNavigation();
  const [role, setRole] = useState(null);

  const [location, setLocation] = useState(null);
  const [selectedForm, setSelectedForm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [hasChristmasBonus, setHasChristmasBonus] = useState(false);
  const [hasHolidayBonus, setHasHolidayBonus] = useState(false);
  const [radius, setRadius] = useState(10); // in km

  useEffect(() => {
    fetchUserRole();
    getLocation();
  }, []);

  const fetchUserRole = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!error) setRole(data?.role);
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Standort nicht erlaubt', 'Bitte Standortzugriff erlauben.');
      return;
    }
    const currentLocation = await Location.getCurrentPositionAsync({});
    setLocation(currentLocation);
  };

  const applyFilters = () => {
    const filters = {
      location: location?.coords,
      employmentForm: selectedForm,
      employmentType: selectedType,
      hasChristmasBonus,
      hasHolidayBonus,
      radius,
    };
    console.log('Filter angewendet:', filters);
    // hier kannst du das an deine Match-Logik übergeben
    Alert.alert('Filter übernommen!');
    navigation.navigate('Swipes', { filters,
  role: role        // deine Rolle
});

  };

  if (role && role !== 'employee') {
    return (
      <View style={styles.centered}>
        <Text>Nur Arbeitnehmer können Filter setzen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🔙 Header mit jatch + Back-Pfeil */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Filter</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 🗺️ Karten-Ausschnitt */}
        <Text style={styles.heading}>Standort</Text>
        {location && (
          <MapView
            style={styles.map}
            region={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker coordinate={location.coords} title="Dein Standort" />
          </MapView>
        )}

        {/* 📏 Entfernungsregler */}
        <Text style={styles.heading}>Entfernung (km)</Text>
        <Slider
          style={{ width: '100%' }}
          minimumValue={1}
          maximumValue={100}
          step={1}
          value={radius}
          onValueChange={setRadius}
          minimumTrackTintColor="#fff"
          maximumTrackTintColor="#999"
          thumbTintColor="#fff"
        />
        <Text style={styles.sliderValue}>{radius} km</Text>

        {/* 📋 Beschäftigungsform */}
        <Text style={styles.heading}>Arbeitszeit</Text>
        <View style={styles.chipsContainer}>
          {employmentForms.map((form) => (
            <Pressable
              key={form}
              style={[
                styles.chip,
                selectedForm === form && styles.chipSelected,
              ]}
              onPress={() => setSelectedForm(form)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedForm === form && styles.chipTextSelected,
                ]}
              >
                {form}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 📋 Beschäftigungsart */}
        <Text style={styles.heading}>Beschäftigungsart</Text>
        <View style={styles.chipsContainer}>
          {employmentTypes.map((type) => (
            <Pressable
              key={type}
              style={[
                styles.chip,
                selectedType === type && styles.chipSelected,
              ]}
              onPress={() => setSelectedType(type)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedType === type && styles.chipTextSelected,
                ]}
              >
                {type}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 💰 Extras */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Weihnachtsgeld</Text>
          <Switch
            value={hasChristmasBonus}
            onValueChange={setHasChristmasBonus}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Urlaubsgeld</Text>
          <Switch value={hasHolidayBonus} onValueChange={setHasHolidayBonus} />
        </View>

        {/* 🟦 Filter übernehmen */}
        <View style={{ marginTop: 30 }}>
          <Pressable style={styles.button} onPress={applyFilters}>
            <Text style={styles.buttonText}>Filter übernehmen</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4db3f4',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4db3f4',
  },
  headerTitle: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  content: {
    padding: 16,
    backgroundColor: '#4db3f4',
    paddingBottom: 100,
  },
  heading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#fff',
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 10,
  },
  sliderValue: {
    color: '#fff',
    textAlign: 'right',
    marginTop: 5,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  chip: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#003f6b',
  },
  chipText: {
    color: '#003f6b',
    fontWeight: 'bold',
  },
  chipTextSelected: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  switchLabel: {
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#003f6b',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
