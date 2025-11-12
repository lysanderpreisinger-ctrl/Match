// screens/FilterScreenEmployer.js
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

// 🔤 aus deinem Context – nicht direkt i18n
import { useLang } from '../LanguageContext';

const PRIMARY = '#4db3f4';
const CARD_BG = '#fff';
const CARD_BORDER = '#eef2f7';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6b7280';

// genau deine Optionen
const EMPLOYMENT_TYPES = ['Vollzeit', 'Teilzeit', 'Minijob'];
const INDUSTRIES = ['IT', 'Handwerk', 'Gastronomie', 'Logistik', 'Vertrieb'];
const AVAILABILITIES = ['Sofort', 'in 30 Tagen'];

export default function FilterScreenEmployer() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLang(); // 👈 Sprache aus Context

  // kommt von Swipes:
  // navigation.navigate('FilterScreenEmployer', { session, role, onApply: (f)=>setFilters(f) })
  const { session, role = 'employer', onApply } = route.params || {};

  const [employmentType, setEmploymentType] = useState('');
  const [industry, setIndustry] = useState('');
  const [availability, setAvailability] = useState('');
  const [minExp, setMinExp] = useState(0);
  const [german, setGerman] = useState(1);

  const handleApply = () => {
    const filters = {
      // 🔴 WICHTIG für Swipes.js Methode 2:
      // dort erwartest du ein ARRAY, damit .cs.{...} funktioniert
      employment_type: employmentType ? [employmentType] : [],
      industry: industry || null,
      availability: availability || null,
      min_experience_years: minExp || 0,
      german_level_1_10: german || 1,
    };

    if (typeof onApply === 'function') {
      onApply(filters);
    }

    navigation.goBack();
  };

  // kleine Helper für Fallbacks
  const tt = (key, fallback) => t(key) || fallback;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {tt('common.filter', 'Filter')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Beschäftigungstyp */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {tt('job.employmentType', 'Beschäftigungstyp')}
          </Text>
          <View style={styles.chips}>
            {EMPLOYMENT_TYPES.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => setEmploymentType(employmentType === opt ? '' : opt)}
                style={[
                  styles.chip,
                  employmentType === opt && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    employmentType === opt && styles.chipTextSelected,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Branche */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {tt('job.industry', 'Branche')}
          </Text>
          <View style={styles.chips}>
            {INDUSTRIES.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => setIndustry(industry === opt ? '' : opt)}
                style={[
                  styles.chip,
                  industry === opt && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    industry === opt && styles.chipTextSelected,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Verfügbarkeit */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {tt('job.availability', 'Verfügbarkeit')}
          </Text>
          <View style={styles.chips}>
            {AVAILABILITIES.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => setAvailability(availability === opt ? '' : opt)}
                style={[
                  styles.chip,
                  availability === opt && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    availability === opt && styles.chipTextSelected,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Erfahrung */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {tt('job.experience', 'Berufserfahrung')}
          </Text>
          <Text style={styles.cardSub}>
            {tt('job.experienceHint', 'Mindest-Erfahrung in Jahren')}
          </Text>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>{tt('job.min', 'Mindestens')}</Text>
            <Text style={styles.sliderValue}>
              {minExp} {tt('job.years', 'Jahre')}
            </Text>
          </View>
          <Slider
            style={{ width: '100%', marginTop: 4 }}
            minimumValue={0}
            maximumValue={20}
            step={1}
            value={minExp}
            onValueChange={setMinExp}
            minimumTrackTintColor={PRIMARY}
            maximumTrackTintColor="#d1d5db"
            thumbTintColor={PRIMARY}
          />
        </View>

        {/* Deutsch */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {tt('job.german', 'Deutschkenntnisse')}
          </Text>
          <Text style={styles.cardSub}>
            {tt('job.germanHint', 'Schieberegler 1 (kaum) – 10 (sehr gut)')}
          </Text>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>
              {tt('job.minLevel', 'Mindest-Level')}
            </Text>
            <Text style={styles.sliderValue}>{german}/10</Text>
          </View>
          <Slider
            style={{ width: '100%', marginTop: 4 }}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={german}
            onValueChange={setGerman}
            minimumTrackTintColor={PRIMARY}
            maximumTrackTintColor="#d1d5db"
            thumbTintColor={PRIMARY}
          />
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.cta} onPress={handleApply}>
          <Text style={styles.ctaText}>
            {tt('common.applyFilters', 'Filter übernehmen')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f8fb' },
  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK, marginBottom: 8 },
  cardSub: { fontSize: 12, color: TEXT_MUTED, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: '#e2ecf5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: PRIMARY },
  chipText: { color: '#0f172a', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sliderLabel: { color: TEXT_MUTED, fontSize: 13 },
  sliderValue: { color: TEXT_DARK, fontSize: 13, fontWeight: '700' },
  cta: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
