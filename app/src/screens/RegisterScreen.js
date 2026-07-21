import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useAuth } from '../AuthContext';
import { Card, Field, Button, Label, ErrorText } from '../components/ui';
import { colors } from '../theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '700', marginBottom: 16 }}>Create account</Text>
        <Card>
          <Label>Name</Label>
          <Field value={name} onChangeText={setName} placeholder="Your name" />
          <Label>Email</Label>
          <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          <Label>Password (min 8 characters)</Label>
          <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
          <ErrorText>{error}</ErrorText>
          <Button title="Sign up" onPress={submit} loading={busy} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
