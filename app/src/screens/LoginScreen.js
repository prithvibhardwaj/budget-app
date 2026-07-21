import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';
import { useAuth } from '../AuthContext';
import { Card, Field, Button, Label, ErrorText } from '../components/ui';
import { colors } from '../theme';
import { getBaseUrl, setBaseUrl } from '../api';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverOpen, setServerOpen] = useState(false);
  const [server, setServer] = useState(getBaseUrl());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      if (server && server !== getBaseUrl()) await setBaseUrl(server);
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '700', marginBottom: 4 }}>Budget</Text>
        <Text style={{ color: colors.muted, marginBottom: 24 }}>Log expenses by texting yourself on WhatsApp.</Text>
        <Card>
          <Label>Email</Label>
          <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          <Label>Password</Label>
          <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
          <ErrorText>{error}</ErrorText>
          <Button title="Log in" onPress={submit} loading={busy} />
          <Pressable onPress={() => navigation.navigate('Register')} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.accent }}>New here? Create an account</Text>
          </Pressable>
        </Card>
        <Pressable onPress={() => setServerOpen(!serverOpen)} style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{serverOpen ? 'Hide' : 'Server settings'}</Text>
        </Pressable>
        {serverOpen && (
          <Card style={{ marginTop: 10 }}>
            <Label>Server URL</Label>
            <Field value={server} onChangeText={setServer} autoCapitalize="none" placeholder="https://your-backend.up.railway.app" />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
