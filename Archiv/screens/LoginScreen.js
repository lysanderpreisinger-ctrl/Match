import React, { useState } from 'react';
import {
  Alert, TextInput, View, TouchableOpacity, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import { supabase } from '../supabaseClient';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

 async function handleLogin() {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      Alert.alert('Fehler', error.message);
      return;
    }

    const session = data.session;
    // Rolle aus profiles holen
    const { data: prof } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    const role = (prof?.role || 'employee').toLowerCase();

    // ⬇️ WICHTIG: Reset auf den Tab-Stack "Main"
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { session, role } }],
    });
  } catch (err) {
    Alert.alert('Fehler', err.message);
  }
}

  return (
    <View style={styles.loginContainer}>
      <Text style={styles.logo}>Jatch</Text>
      <Text style={styles.slogan}>Dein Job – dein Match</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="E-Mail"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Passwort"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Login</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.registerText}>Noch kein Konto? Jetzt registrieren</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* styles bleiben wie bei dir */

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4db3f4',
    marginBottom: 8,
  },
  slogan: {
    fontSize: 16,
    color: '#555',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
  },
  loginButton: {
    backgroundColor: '#4db3f4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerText: {
    color: '#4db3f4',
    textAlign: 'center',
    marginTop: 8,
  },
});
