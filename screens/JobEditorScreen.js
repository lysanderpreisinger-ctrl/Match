// screens/JobEditorScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { supabase } from '../supabaseClient';
import i18n from '../i18n';

const G = '#4db3f4';
const PH = '#6b7280';

// Vorschläge OHNE (m/w/d), weil wir das jetzt im eigenen Feld machen
const TITLE_SUGGESTIONS = [
  'Verkäufer',
  'Koch',
  'Servicekraft',
  'Pflegefachkraft',
  'Frontend Developer',
  'Backend Developer',
  'Projektmanager',
  'Lagerist',
  'Fahrer',
  'Vertriebsmitarbeiter',
];

const CHIP_OPTIONS_TYPE = ['Vollzeit', 'Teilzeit', 'Minijob', 'Werkstudent', 'Praktikum'];
const CHIP_OPTIONS_FORM = ['Festanstellung', 'Freelance', 'Befristet'];

// Sprachen
const LANG_OPTIONS = [
  { value: 'Deutsch', label: i18n.t('jobEditor.langGerman') },
  { value: 'Englisch', label: i18n.t('jobEditor.langEnglish') },
];

// Branchen
const INDUSTRY_OPTIONS = [
  { value: 'IT', label: i18n.t('jobEditor.industryIT') },
  { value: 'Handwerk', label: i18n.t('jobEditor.industryCraft') },
  { value: 'Gastronomie', label: i18n.t('jobEditor.industryGastro') },
  { value: 'Logistik', label: i18n.t('jobEditor.industryLogistics') },
  { value: 'Vertrieb', label: i18n.t('jobEditor.industrySales') },
  { value: 'Sonstiges', label: i18n.t('jobEditor.industryOther') },
];

// m/w/d
const GENDER_OPTIONS = [
  { value: 'm', label: i18n.t('jobEditor.genderMale') },
  { value: 'w', label: i18n.t('jobEditor.genderFemale') },
  { value: 'd', label: i18n.t('jobEditor.genderDiverse') },
];

// Gehalts-Ansicht
const VIEW_MODES = [
  { key: 'month_gross', label: 'Monat Brutto' },
  { key: 'month_net', label: 'Monat Netto' },
  { key: 'year_gross', label: 'Jahr Brutto' },
  { key: 'year_net', label: 'Jahr Netto' },
];

export default function JobEditorScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const jobId = route?.params?.jobId ?? null;
  const sessionFromParams = route?.params?.session ?? null;

  // Back-Swipe aus
  useEffect(() => {
    navigation.setOptions?.({
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
    });
  }, [navigation]);

  const [session, setSession] = useState(sessionFromParams);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!jobId);

  // Formular
  const [title, setTitle] = useState('');
  const [titleQuery, setTitleQuery] = useState('');

  const [genderTags, setGenderTags] = useState(['m', 'w', 'd']);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [employmentForms, setEmploymentForms] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');

  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [viewMode, setViewMode] = useState('month_gross');

  const [xmasBonus, setXmasBonus] = useState(false);
  const [holidayBonus, setHolidayBonus] = useState(false);

  const [availableNow, setAvailableNow] = useState(true);
  const [availableFrom, setAvailableFrom] = useState('');
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  // Adresse
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);

  const [isActive, setIsActive] = useState(true);

  // Session fallback
  useEffect(() => {
    if (!session) {
      (async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session) setSession(data.session);
      })();
    }
  }, [session]);

  // Job laden
  useEffect(() => {
    if (!jobId || !session?.user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('employer_id', session.user.id)
        .single();

      if (error) {
        console.error(error);
        Alert.alert(i18n.t('jobEditor.errorTitle'), i18n.t('jobEditor.errorLoadText'));
      } else if (data) {
        setTitle(data.title ?? '');

        // Gender
        if (Array.isArray(data.gender_tags) && data.gender_tags.length > 0) {
          setGenderTags(data.gender_tags);
        } else {
          setGenderTags(['m', 'w', 'd']);
        }

        // Beschäftigungstyp
        setEmploymentTypes(
          Array.isArray(data.employment_type)
            ? data.employment_type
            : data.employment_type
            ? [data.employment_type]
            : []
        );

        // Beschäftigungsform
        setEmploymentForms(
          Array.isArray(data.employment_form)
            ? data.employment_form
            : data.employment_form
            ? [data.employment_form]
            : []
        );

        // Sprachen → nur Deutsch/Englisch zulassen
        const loadedLangs = Array.isArray(data.language)
          ? data.language
          : data.language
          ? [data.language]
          : [];
        setLanguages(loadedLangs.filter((l) => l === 'Deutsch' || l === 'Englisch'));

        // Branche
        if (data.industry) {
          const isKnown = INDUSTRY_OPTIONS.some((opt) => opt.value === data.industry);
          if (isKnown) {
            setIndustry(data.industry);
            setCustomIndustry('');
          } else {
            setIndustry('Sonstiges');
            setCustomIndustry(data.industry);
          }
        }

        setSalaryMin(data.salary_min?.toString() ?? '');
        setSalaryMax(data.salary_max?.toString() ?? '');
        setXmasBonus(!!data.christmas_bonus);
        setHolidayBonus(!!data.holiday_bonus);
        setAvailableNow(data.available_now ?? true);
        setAvailableFrom(data.available_from ?? '');
        setStreet(data.street ?? '');
        setHouseNumber(data.house_number ?? '');
        setPostalCode(data.postal_code ?? '');
        setCity(data.location_city ?? '');
        setLat(data.latitude ?? null);
        setLng(data.longitude ?? null);
        setIsActive(data.is_active ?? true);
      }
      setLoading(false);
    })();
  }, [jobId, session?.user?.id]);

  const toggleInArray = (arr, setArr, value) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  // Standort
  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(i18n.t('jobEditor.locationPermTitle'), i18n.t('jobEditor.locationPermText'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      setLat(latitude);
      setLng(longitude);

      const geos = await Location.reverseGeocodeAsync({ latitude, longitude });
      const first = geos?.[0];
      if (first) {
        setStreet(first.street || '');
        setHouseNumber(first.name || '');
        setPostalCode(first.postalCode || '');
        setCity(first.city || first.subregion || first.region || '');
      }
      Alert.alert(i18n.t('jobEditor.addressFilledTitle'), i18n.t('jobEditor.addressFilledText'));
    } catch (e) {
      console.error(e);
      Alert.alert(i18n.t('jobEditor.errorTitle'), i18n.t('jobEditor.locationErrorText'));
    }
  };

  // Titel-Vorschläge
  const filteredTitleSuggestions = useMemo(() => {
    const q = titleQuery.trim().toLowerCase();
    if (!q) return [];
    return TITLE_SUGGESTIONS.filter((t) => t.toLowerCase().includes(q)).slice(0, 8);
  }, [titleQuery]);

  const takeTitleSuggestion = (t) => {
    setTitle(t);
    setTitleQuery('');
  };

  // Gehalt
  const toNumber = (v) => (v ? Number(v) : 0);
  const estNetMonth = (gross) => Math.max(0, Math.round(gross * 0.62));
  const monthGrossRange = useMemo(
    () => ({ min: toNumber(salaryMin), max: toNumber(salaryMax) }),
    [salaryMin, salaryMax]
  );

  const computeDisplay = (mode, { min, max }) => {
    switch (mode) {
      case 'month_gross':
        return { min, max, suffix: i18n.t('jobEditor.salarySuffixMonthGross') };
      case 'month_net':
        return {
          min: estNetMonth(min),
          max: estNetMonth(max),
          suffix: i18n.t('jobEditor.salarySuffixMonthNet'),
        };
      case 'year_gross':
        return {
          min: min * 12,
          max: max * 12,
          suffix: i18n.t('jobEditor.salarySuffixYearGross'),
        };
      case 'year_net':
        return {
          min: estNetMonth(min) * 12,
          max: estNetMonth(max) * 12,
          suffix: i18n.t('jobEditor.salarySuffixYearNet'),
        };
      default:
        return { min, max, suffix: '' };
    }
  };

  const displayRange = computeDisplay(viewMode, monthGrossRange);

  const save = async () => {
    if (!session?.user?.id) return;
    if (!title.trim()) {
      return Alert.alert(
        i18n.t('jobEditor.alertTitleMissing'),
        i18n.t('jobEditor.alertTitleMissingText')
      );
    }
    if (genderTags.length === 0) {
      return Alert.alert(
        i18n.t('jobEditor.sectionGender'),
        i18n.t('jobEditor.sectionGenderInfo')
      );
    }
    if (!availableNow && !/^\d{4}-\d{2}-\d{2}$/.test(availableFrom)) {
      return Alert.alert(
        i18n.t('jobEditor.alertDateInvalid'),
        i18n.t('jobEditor.alertDateInvalidText')
      );
    }

    // Branche finalisieren
    let finalIndustry = null;
    if (industry === 'Sonstiges') {
      finalIndustry = customIndustry?.trim() ? customIndustry.trim() : 'Sonstiges';
    } else if (industry) {
      finalIndustry = industry;
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      gender_tags: genderTags,
      employment_type: employmentTypes,
      employment_form: employmentForms,
      language: languages,
      industry: finalIndustry,
      salary_min: salaryMin ? Number(salaryMin) : null,
      salary_max: salaryMax ? Number(salaryMax) : null,
      christmas_bonus: xmasBonus,
      holiday_bonus: holidayBonus,
      available_now: availableNow,
      available_from: availableNow ? null : availableFrom || null,
      required_experience_years: null,
      street: street || null,
      house_number: houseNumber || null,
      postal_code: postalCode || null,
      location_city: city || null,
      latitude: lat,
      longitude: lng,
      is_active: isActive,
    };

    try {
      if (jobId) {
        const { error } = await supabase
          .from('jobs')
          .update(payload)
          .eq('id', jobId)
          .eq('employer_id', session.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('jobs')
          .insert([{ ...payload, employer_id: session.user.id }]);
        if (error) throw error;
      }
      Alert.alert(i18n.t('jobEditor.alertSaved'), i18n.t('jobEditor.alertSavedText'));
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert(i18n.t('jobEditor.alertError'), i18n.t('jobEditor.alertErrorText'));
    } finally {
      setSaving(false);
    }
  };

  const SectionLabel = ({ children, onInfo }) => (
    <View style={styles.labelRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.label}>{children}</Text>
        {onInfo ? (
          <TouchableOpacity
            onPress={onInfo}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: 6 }}
          >
            <Ionicons name="information-circle-outline" size={18} color={G} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const Chip = ({ text, selected, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{text}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#666' }}>{i18n.t('jobEditor.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={G} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {jobId ? i18n.t('jobEditor.titleEdit') : i18n.t('jobEditor.titleNew')}
        </Text>
        <TouchableOpacity onPress={save} disabled={saving}>
          <Ionicons name="save-outline" size={22} color={saving ? '#9ca3af' : G} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Titel */}
        <SectionLabel
          onInfo={() =>
            Alert.alert(
              i18n.t('jobEditor.sectionTitle'),
              i18n.t('jobEditor.sectionTitleInfo')
            )
          }
        >
          {i18n.t('jobEditor.sectionTitle')}
        </SectionLabel>
        <View style={{ position: 'relative' }}>
          <TextInput
            placeholder={i18n.t('jobEditor.placeholderTitle')}
            placeholderTextColor={PH}
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              setTitleQuery(t);
            }}
            style={styles.input}
          />
          {titleQuery.trim() !== '' && (
            <View style={styles.suggestBox}>
              {filteredTitleSuggestions.length > 0 ? (
                filteredTitleSuggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestItem}
                    onPress={() => takeTitleSuggestion(s)}
                  >
                    <Text style={{ color: '#111827' }}>{s}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.suggestItem}>
                  <Text style={{ color: '#6b7280' }}>
                    {i18n.t('jobEditor.noSuggestions')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Geschlechtsangabe */}
        <SectionLabel
          onInfo={() =>
            Alert.alert(
              i18n.t('jobEditor.sectionGender'),
              i18n.t('jobEditor.sectionGenderInfo')
            )
          }
        >
          {i18n.t('jobEditor.sectionGender')}
        </SectionLabel>
        <View style={styles.chipsRow}>
          {GENDER_OPTIONS.map((g) => (
            <Chip
              key={g.value}
              text={g.label}
              selected={genderTags.includes(g.value)}
              onPress={() => toggleInArray(genderTags, setGenderTags, g.value)}
            />
          ))}
        </View>

        {/* Beschäftigungstyp */}
        <SectionLabel
          onInfo={() =>
            Alert.alert(
              i18n.t('jobEditor.sectionEmploymentType'),
              i18n.t('jobEditor.sectionEmploymentTypeInfo')
            )
          }
        >
          {i18n.t('jobEditor.sectionEmploymentType')}
        </SectionLabel>
        <View style={styles.chipsRow}>
          {CHIP_OPTIONS_TYPE.map((opt) => (
            <Chip
              key={opt}
              text={opt}
              selected={employmentTypes.includes(opt)}
              onPress={() => toggleInArray(employmentTypes, setEmploymentTypes, opt)}
            />
          ))}
        </View>

        {/* Beschäftigungsform */}
        <SectionLabel
          onInfo={() =>
            Alert.alert(
              i18n.t('jobEditor.sectionEmploymentForm'),
              i18n.t('jobEditor.sectionEmploymentFormInfo')
            )
          }
        >
          {i18n.t('jobEditor.sectionEmploymentForm')}
        </SectionLabel>
        <View style={styles.chipsRow}>
          {CHIP_OPTIONS_FORM.map((opt) => (
            <Chip
              key={opt}
              text={opt}
              selected={employmentForms.includes(opt)}
              onPress={() => toggleInArray(employmentForms, setEmploymentForms, opt)}
            />
          ))}
        </View>

        {/* Sprachen */}
        <SectionLabel
          onInfo={() =>
            Alert.alert(
              i18n.t('jobEditor.sectionLanguages'),
              i18n.t('jobEditor.sectionLanguagesInfo')
            )
          }
        >
          {i18n.t('jobEditor.sectionLanguages')}
        </SectionLabel>
        <View style={styles.chipsRow}>
          {LANG_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              text={opt.label}
              selected={languages.includes(opt.value)}
              onPress={() => toggleInArray(languages, setLanguages, opt.value)}
            />
          ))}
        </View>

        {/* Branche */}
        <SectionLabel
          onInfo={() =>
            Alert.alert(
              i18n.t('jobEditor.sectionIndustry'),
              i18n.t('jobEditor.sectionIndustryInfo')
            )
          }
        >
          {i18n.t('jobEditor.sectionIndustry')}
        </SectionLabel>
        <View style={styles.chipsRow}>
          {INDUSTRY_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              text={opt.label}
              selected={industry === opt.value}
              onPress={() => {
                setIndustry(industry === opt.value ? '' : opt.value);
                if (opt.value !== 'Sonstiges') setCustomIndustry('');
              }}
            />
          ))}
        </View>
        {industry === 'Sonstiges' && (
          <TextInput
            style={styles.input}
            placeholder={i18n.t('jobEditor.industryOtherPlaceholder')}
            placeholderTextColor={PH}
            value={customIndustry}
            onChangeText={setCustomIndustry}
          />
        )}

        {/* Gehalt */}
        <SectionLabel
          onInfo={() =>
            Alert.alert(i18n.t('jobEditor.sectionSalary'), i18n.t('jobEditor.sectionSalaryInfo'))
          }
        >
          {i18n.t('jobEditor.sectionSalary')}
        </SectionLabel>
        <View style={{ flexDirection: 'row' }}>
          <TextInput
            placeholder="3000"
            placeholderTextColor={PH}
            keyboardType="numeric"
            value={salaryMin}
            onChangeText={setSalaryMin}
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <TextInput
            placeholder="4500"
            placeholderTextColor={PH}
            keyboardType="numeric"
            value={salaryMax}
            onChangeText={setSalaryMax}
            style={[styles.input, { flex: 1 }]}
          />
        </View>

        {/* Gehalts-Ansicht */}
        <View style={styles.segmentRow}>
          {VIEW_MODES.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.segmentBtn, viewMode === m.key && styles.segmentBtnOn]}
              onPress={() => setViewMode(m.key)}
            >
              <Text style={[styles.segmentText, viewMode === m.key && styles.segmentTextOn]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.estimateBox}>
          <Text style={styles.estimateText}>
            {displayRange.min && displayRange.max
              ? `${displayRange.min?.toLocaleString('de-DE')} € – ${displayRange.max?.toLocaleString(
                  'de-DE'
                )} € · ${displayRange.suffix}`
              : i18n.t('jobEditor.salaryEnter')}
          </Text>
          {viewMode.includes('net') && (
            <Text style={styles.estimateHint}>{i18n.t('jobEditor.netHint')}</Text>
          )}
        </View>

        {/* Verfügbarkeit */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabelWrap}>
            <Text style={styles.switchLabel}>{i18n.t('jobEditor.switchAvailableNow')}</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  i18n.t('jobEditor.switchAvailableNow'),
                  i18n.t('jobEditor.switchAvailableNowInfo')
                )
              }
            >
              <Ionicons name="information-circle-outline" size={18} color={G} />
            </TouchableOpacity>
          </View>
          <Switch
            value={availableNow}
            onValueChange={(v) => {
              setAvailableNow(v);
              if (v) setAvailableFrom('');
            }}
          />
        </View>

        {!availableNow && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.smallLabel}>{i18n.t('jobEditor.availableFrom')}</Text>

            <TouchableOpacity
              onPress={() => setDatePickerVisible(true)}
              style={[
                styles.input,
                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
              ]}
            >
              <Text style={availableFrom ? styles.dateText : styles.datePlaceholder}>
                {availableFrom || i18n.t('jobEditor.chooseDate')}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={G} />
            </TouchableOpacity>

            {/* 👇 HIER ist der Fix */}
            <DateTimePickerModal
              isVisible={isDatePickerVisible}
              mode="date"
              date={availableFrom ? new Date(availableFrom) : new Date()}
              minimumDate={new Date()}
              onConfirm={(date) => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                setAvailableFrom(`${yyyy}-${mm}-${dd}`);
                setDatePickerVisible(false);
              }}
              onCancel={() => setDatePickerVisible(false)}
              isDarkModeEnabled={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              textColor={Platform.OS === 'ios' ? '#000000' : undefined}   // 👈 wichtig
              pickerContainerStyleIOS={styles.iosPickerContainer}          // 👈 heller BG
            />
          </View>
        )}

        {/* Weihnachtsgeld */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabelWrap}>
            <Text style={styles.switchLabel}>{i18n.t('jobEditor.switchXmas')}</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(i18n.t('jobEditor.switchXmas'), i18n.t('jobEditor.switchXmasInfo'))
              }
            >
              <Ionicons name="information-circle-outline" size={18} color={G} />
            </TouchableOpacity>
          </View>
          <Switch value={xmasBonus} onValueChange={setXmasBonus} />
        </View>

        {/* Urlaubsgeld */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabelWrap}>
            <Text style={styles.switchLabel}>{i18n.t('jobEditor.switchHoliday')}</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(i18n.t('jobEditor.switchHoliday'), i18n.t('jobEditor.switchHolidayInfo'))
              }
            >
              <Ionicons name="information-circle-outline" size={18} color={G} />
            </TouchableOpacity>
          </View>
          <Switch value={holidayBonus} onValueChange={setHolidayBonus} />
        </View>

        {/* Anzeige aktiv */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabelWrap}>
            <Text style={styles.switchLabel}>{i18n.t('jobEditor.switchActive')}</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(i18n.t('jobEditor.switchActive'), i18n.t('jobEditor.switchActiveInfo'))
              }
            >
              <Ionicons name="information-circle-outline" size={18} color={G} />
            </TouchableOpacity>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>

        {/* Adresse */}
        <SectionLabel
          onInfo={() =>
            Alert.alert(
              i18n.t('jobEditor.sectionAddress'),
              i18n.t('jobEditor.sectionAddressInfo')
            )
          }
        >
          {i18n.t('jobEditor.sectionAddress')}
        </SectionLabel>
        <TextInput
          placeholder={i18n.t('jobEditor.streetPlaceholder')}
          placeholderTextColor={PH}
          value={street}
          onChangeText={setStreet}
          style={styles.input}
        />
        <View style={{ flexDirection: 'row' }}>
          <TextInput
            placeholder={i18n.t('jobEditor.houseNumberPlaceholder')}
            placeholderTextColor={PH}
            value={houseNumber}
            onChangeText={setHouseNumber}
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <TextInput
            placeholder={i18n.t('jobEditor.postalCodePlaceholder')}
            placeholderTextColor={PH}
            keyboardType="number-pad"
            value={postalCode}
            onChangeText={setPostalCode}
            style={[styles.input, { flex: 1 }]}
          />
        </View>
        <TextInput
          placeholder={i18n.t('jobEditor.cityPlaceholder')}
          placeholderTextColor={PH}
          value={city}
          onChangeText={setCity}
          style={styles.input}
        />

        {/* Koordinaten */}
        <View style={styles.coordRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.coordLabel}>{i18n.t('jobEditor.coordsLabel')}</Text>
            <Text style={styles.coordText}>
              {lat && lng
                ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                : i18n.t('jobEditor.coordsUnset')}
            </Text>
          </View>
          <TouchableOpacity style={styles.coordBtn} onPress={useCurrentLocation}>
            <Ionicons name="locate-outline" size={18} color="#fff" />
            <Text style={styles.coordBtnText}>{i18n.t('jobEditor.useLocation')}</Text>
          </TouchableOpacity>
        </View>

        {/* Speichern */}
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>
            {saving
              ? i18n.t('jobEditor.saving')
              : jobId
              ? i18n.t('jobEditor.btnSaveEdit')
              : i18n.t('jobEditor.btnSave')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fb' },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: G },

  labelRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontWeight: '700', color: '#111827' },

  input: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    marginRight: 8,
    marginTop: 8,
  },
  chipOn: { backgroundColor: '#e6f2fb', borderColor: G },
  chipText: { color: '#374151' },
  chipTextOn: { color: G, fontWeight: '700' },

  suggestBox: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 46 : 44,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 10,
  },
  suggestItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },

  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  segmentBtnOn: { backgroundColor: '#e6f2fb', borderColor: G },
  segmentText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  segmentTextOn: { color: G },

  estimateBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    marginTop: 8,
  },
  estimateText: { color: '#111827', fontWeight: '700' },
  estimateHint: { color: '#6b7280', fontSize: 12, marginTop: 4 },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  switchLabelWrap: { flexDirection: 'row', alignItems: 'center' },
  switchLabel: { color: '#111827', fontWeight: '600', marginRight: 6 },

  smallLabel: { marginTop: 8, fontSize: 13, color: '#374151' },

  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  coordLabel: { color: '#374151', fontWeight: '600' },
  coordText: { color: '#111827', marginTop: 4 },
  coordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: G,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  coordBtnText: { color: '#fff', fontWeight: '700' },

  saveBtn: {
    marginTop: 18,
    backgroundColor: G,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },

  // Datum-Anzeige im Textfeld
  dateText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  datePlaceholder: {
    color: '#94a3b8',
  },

  // iOS Picker Container (Modal innen)
  iosPickerContainer: {
    backgroundColor: '#ffffff',
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});
