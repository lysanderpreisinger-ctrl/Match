// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StripeProvider } from '@stripe/stripe-react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Image, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from './supabaseClient';

// Sprache
import { LanguageProvider, useLang } from './LanguageContext';
import i18n from './i18n';

// Screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import Swipes from './screens/Swipes';
import NotificationConsentScreen from './screens/NotificationConsentScreen';
import FilterScreenEmployee from './screens/FilterScreenEmployee';
import FilterScreenEmployer from './screens/FilterScreenEmployer';
import EmployerProfileScreen from './screens/EmployerProfileScreen';
import EmployeeProfileScreen from './screens/EmployeeProfileScreen';
import EmployerSettingsScreen from './screens/EmployerSettingsScreen';
import ChatDetail from './screens/ChatDetail';
import EmployerProfileEditScreen from './screens/EmployerProfileEditScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import ProfileDetailsScreen from './screens/ProfileDetailsScreen';
import EmployeeProfileEditScreen from './screens/EmployeeProfileEditScreen';
import EmployeeProfileViewScreen from './screens/EmployeeProfileViewScreen';
import ResumeDocumentsScreen from './screens/ResumeDocumentsScreen';
import EmployerJobsScreen from './screens/EmployerJobsScreen';
import JobEditorScreen from './screens/JobEditorScreen';
import JobDetailScreen from './screens/JobDetailScreen';
import PaymentScreen from './screens/PaymentScreen';

// Chats
import ChatsAndMatchesScreen from './screens/ChatsAndMatchesScreen';

// ❗️WICHTIG: wir haben jetzt ZWEI Flex-Screens
// 1) Übersicht (Tab, die du mit „2“ markiert hast)
import FlexJobsOverviewScreen from './screens/FlexJobsOverviewScreen';
// 2) Alte Verwaltungsliste (mit Back-Arrow, die du mit „1“ markiert hast)
import FlexJobsScreen from './screens/FlexJobsScreen';

// Flex-Job erstellen
import FlexJobCreateScreen from './screens/FlexJobCreateScreen';
import FlexJobDetailScreen from './screens/FlexJobDetailScreen';


// Settings-Unterseiten
import FeedbackScreen from './screens/FeedbackScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import PaymentMethodsScreen from './screens/PaymentMethodsScreen';
import LanguageScreen from './screens/LanguageScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Bottom-Tabs
 */
function MainTabs({ route }) {
  const { role, session } = route.params;
  const isEmployee = role === 'employee';
  const [avatarUrl, setAvatarUrl] = useState(null);
  const { t } = useLang();

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();
      setAvatarUrl(data?.avatar_url || null);
    })();
  }, [session?.user?.id]);

  return (
    <Tab.Navigator
      key={`tabs-${role}`}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4db3f4',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11 },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 8,
          height: Platform.OS === 'ios' ? 80 : 70,
          paddingBottom: Platform.OS === 'ios' ? 18 : 10,
          paddingTop: 6,
        },
      }}
    >
      {/* SWIPES */}
      <Tab.Screen
        name="SwipesTab"
        component={Swipes}
        initialParams={{ role, session }}
        options={{
          tabBarLabel: 'jatch',
          tabBarIcon: ({ color, size, focused }) => (
            <Image
              source={require('./assets/images/jatch-icon.png')}
              style={{
                width: focused ? size + 4 : size,
                height: focused ? size + 4 : size,
                tintColor: color,
              }}
            />
          ),
        }}
      />

      {/* FLEX-JOBS → das ist deine Übersicht (die „2“) */}
      <Tab.Screen
        name="FlexJobsTab"
        component={FlexJobsOverviewScreen}
        initialParams={{ session, role }}
        options={{
          tabBarLabel: t('tabs.flex') || 'Flex-Jobs',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name="flash-outline"
              color={color}
              size={focused ? size + 2 : size}
            />
          ),
        }}
      />

      {/* CHATS */}
      <Tab.Screen
        name="ChatsAndMatchesTab"
        component={ChatsAndMatchesScreen}
        initialParams={{ session, role }}
        options={{
          tabBarLabel: t('tabs.chats') || 'Chats',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name="chatbubble-ellipses-outline"
              color={color}
              size={focused ? size + 2 : size}
            />
          ),
        }}
      />

      {/* PROFIL */}
      <Tab.Screen
        name={isEmployee ? 'EmployeeProfileTab' : 'EmployerProfileTab'}
        component={isEmployee ? EmployeeProfileScreen : EmployerProfileScreen}
        initialParams={{ role, session }}
        options={{
          tabBarLabel: t('tabs.profile') || 'Profil',
          tabBarIcon: ({ size, color, focused }) =>
            avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{
                  width: focused ? size + 8 : size + 4,
                  height: focused ? size + 8 : size + 4,
                  borderRadius: (size + 8) / 2,
                  borderWidth: 2,
                  borderColor: '#4db3f4',
                }}
              />
            ) : (
              <Ionicons
                name="person-circle"
                color={color}
                size={focused ? size + 6 : size + 4}
              />
            ),
        }}
      />
    </Tab.Navigator>
  );
}

// ---------- Root ----------
export default function App() {
  const STRIPE_PUBLISHABLE_KEY =
    'pk_test_51RueT8Bh0hSWnazMHhnWncmbYhA615MQ8XmsHtICJBs0HOGDi4f48eNnrT9EcKk7MBNp16CwSwglnsh9BbqaKvYA0066U7wMy8';

  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let sub;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session ?? null);
      if (session?.user?.id) await loadRole(session.user.id);
      else setRole(null);

      const res = supabase.auth.onAuthStateChange(async (_event, s) => {
        setSession(s ?? null);
        if (s?.user?.id) await loadRole(s.user.id);
        else setRole(null);
      });
      sub = res.data.subscription;
      setBooting(false);
    })();

    return () => sub?.unsubscribe();
  }, []);

  async function loadRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    const r = (data?.role || 'employee').toString().trim().toLowerCase();
    setRole(r === 'employer' ? 'employer' : 'employee');
  }

  if (booting) {
    return (
      <GestureHandlerRootView
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color="#4db3f4" />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <LanguageProvider session={session} initialLang={i18n.locale}>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
              {/* Auth */}
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />

              {/* Notification Consent */}
              <Stack.Screen
                name="NotificationConsentScreen"
                component={NotificationConsentScreen}
              />

              {/* Haupt-App */}
              {session && role && (
                <Stack.Screen
                  name="Main"
                  component={MainTabs}
                  initialParams={{ session, role }}
                />
              )}

              {/* 🔵 WICHTIG: das ist die alte Flex-Jobs-Seite (deine „1“)
                  Auf diese Seite navigierst du aus EmployerProfileScreen mit
                  navigation.navigate('FlexJobs', { session, role: 'employer' })
              */}
              <Stack.Screen name="FlexJobs" component={FlexJobsScreen} />

              {/* Filter */}
              <Stack.Screen name="FilterScreenEmployee" component={FilterScreenEmployee} />
              <Stack.Screen name="FilterScreenEmployer" component={FilterScreenEmployer} />

              {/* Settings */}
              <Stack.Screen name="EmployerSettingsScreen" component={EmployerSettingsScreen} />

              {/* Chats */}
              <Stack.Screen name="ChatDetail" component={ChatDetail} />

              {/* Profile */}
              <Stack.Screen name="EmployerProfileEdit" component={EmployerProfileEditScreen} />
              <Stack.Screen name="EmployeeProfileEdit" component={EmployeeProfileEditScreen} />
              <Stack.Screen name="EmployeeProfileViewScreen" component={EmployeeProfileViewScreen} />
              <Stack.Screen name="ProfileDetailsScreen" component={ProfileDetailsScreen} />

              {/* Doks */}
              <Stack.Screen name="ResumeDocumentsScreen" component={ResumeDocumentsScreen} />

              {/* Jobs */}
              <Stack.Screen name="EmployerJobs" component={EmployerJobsScreen} />
              <Stack.Screen name="JobEditorScreen" component={JobEditorScreen} />
              <Stack.Screen name="JobDetailScreen" component={JobDetailScreen} />

              {/* Zahlungen */}
              <Stack.Screen name="SubscriptionScreen" component={SubscriptionScreen} />
              <Stack.Screen name="PaymentScreen" component={PaymentScreen} />

              {/* Flex-Job erstellen */}
              <Stack.Screen name="FlexJobCreate" component={FlexJobCreateScreen} />
              <Stack.Screen name="FlexJobDetail" component={FlexJobDetailScreen} />


              {/* Settings-Unterseiten */}
              <Stack.Screen name="FeedbackScreen" component={FeedbackScreen} />
              <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
              <Stack.Screen name="PaymentMethodsScreen" component={PaymentMethodsScreen} />
              <Stack.Screen name="LanguageScreen" component={LanguageScreen} />


            </Stack.Navigator>
          </NavigationContainer>
        </LanguageProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
