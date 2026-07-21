import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { useAuth } from '../AuthContext';
import { Card, Field, Button, Label, ErrorText, Title } from '../components/ui';
import { colors } from '../theme';
import { getBaseUrl, setBaseUrl } from '../api';

export default function WelcomeScreen() {
  const { createDeviceAccount, finishOnboarding, restore, loginWithEmail } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('start'); // start | restore | email | saveCode
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(getBaseUrl());
  const [serverOpen, setServerOpen] = useState(false);

  async function applyServer() {
    if (server && server !== getBaseUrl()) await setBaseUrl(server);
  }

  async function start() {
    setError(''); setBusy(true);
    try {
      await applyServer();
      const rc = await createDeviceAccount();
      setNewCode(rc);
      setMode('saveCode');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function doRestore() {
    setError(''); setBusy(true);
    try {
      await applyServer();
      await restore(code.trim());
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function doEmail() {
    setError(''); setBusy(true);
    try {
      await applyServer();
      await loginWithEmail(email.trim(), password);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  // Shown once, right after the account is made. Continuing just enters the app —
  // the code stays visible in Settings, so this is a prompt, not a lock.
  if (mode === 'saveCode') {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.page }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
        <Card>
          <Title>Save your recovery code</Title>
          <Text style={{ color: colors.secondary, fontSize: 13, marginBottom: 14 }}>
            This is the only way to reach your data from another phone. There's no email and no password,
            so if you lose this and lose your phone, the data is gone. You can find it again in Settings.
          </Text>
          <View style={{ backgroundColor: colors.page, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 16, letterSpacing: 1, textAlign: 'center', fontFamily: 'monospace' }}>
              {newCode}
            </Text>
          </View>
          <Button title="Copy / share it somewhere safe" kind="ghost" onPress={() => Share.share({ message: `Budget app recovery code: ${newCode}` })} />
          <ErrorText>{error}</ErrorText>
          <Button
            title="I've saved it — continue"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try { await finishOnboarding(); } catch (e) { setError(e.message); } finally { setBusy(false); }
            }}
            style={{ marginTop: 8 }}
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '700', marginBottom: 4 }}>Budget</Text>
        <Text style={{ color: colors.muted, marginBottom: 24 }}>
          Log expenses by texting yourself on WhatsApp.
        </Text>

        {mode === 'start' && (
          <Card>
            <Text style={{ color: colors.secondary, fontSize: 14, marginBottom: 14 }}>
              No email, no password. Tap below and you're in — your data stays tied to this device.
            </Text>
            <ErrorText>{error}</ErrorText>
            <Button title="Get started" onPress={start} loading={busy} />
            <Pressable onPress={() => { setMode('restore'); setError(''); }} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.accent }}>I already have a recovery code</Text>
            </Pressable>
          </Card>
        )}

        {mode === 'restore' && (
          <Card>
            <Title>Restore your account</Title>
            <Label>Recovery code</Label>
            <Field
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder="ABCD-1234-..."
            />
            <ErrorText>{error}</ErrorText>
            <Button title="Restore" onPress={doRestore} loading={busy} disabled={!code.trim()} />
            <Pressable onPress={() => { setMode('start'); setError(''); }} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.muted }}>Back</Text>
            </Pressable>
          </Card>
        )}

        {mode === 'email' && (
          <Card>
            <Title>Sign in with email</Title>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
              Only for accounts made before recovery codes existed.
            </Text>
            <Label>Email</Label>
            <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Label>Password</Label>
            <Field value={password} onChangeText={setPassword} secureTextEntry />
            <ErrorText>{error}</ErrorText>
            <Button title="Sign in" onPress={doEmail} loading={busy} />
            <Pressable onPress={() => { setMode('start'); setError(''); }} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.muted }}>Back</Text>
            </Pressable>
          </Card>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 12 }}>
          {mode !== 'email' && (
            <Pressable onPress={() => { setMode('email'); setError(''); }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Sign in with email</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setServerOpen(!serverOpen)}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{serverOpen ? 'Hide server' : 'Server settings'}</Text>
          </Pressable>
        </View>

        {serverOpen && (
          <Card style={{ marginTop: 10 }}>
            <Label>Server URL</Label>
            <Field value={server} onChangeText={setServer} autoCapitalize="none" />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
