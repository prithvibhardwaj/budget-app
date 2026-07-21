import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Image, Alert } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';
import { Card, Title, Field, Button, Label, ErrorText } from '../components/ui';

export default function LinkWhatsAppScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [state, setState] = useState({ status: user?.wa_linked ? 'connecting' : 'unlinked', qr: null, pairing_code: null });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const polling = useRef(null);

  async function poll() {
    try {
      const s = await api('/api/me/whatsapp/status');
      setState(s);
      if (s.status === 'open') {
        clearInterval(polling.current);
        polling.current = null;
        refreshUser().catch(() => {});
      }
    } catch {}
  }

  function startPolling() {
    if (polling.current) clearInterval(polling.current);
    polling.current = setInterval(poll, 3000);
    poll();
  }

  useEffect(() => {
    if (user?.wa_linked) startPolling();
    return () => polling.current && clearInterval(polling.current);
  }, []);

  async function start(withPhone) {
    setError('');
    setStarting(true);
    try {
      await api('/api/me/whatsapp/link', {
        method: 'POST',
        body: withPhone ? { phone: phone.replace(/\D/g, '') } : {},
      });
      startPolling();
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  function unlink() {
    Alert.alert('Unlink WhatsApp', 'The bot will stop reading your Note to Self messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink', style: 'destructive',
        onPress: async () => {
          await api('/api/me/whatsapp/unlink', { method: 'POST' });
          setState({ status: 'unlinked', qr: null, pairing_code: null });
          refreshUser().catch(() => {});
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.page }} contentContainerStyle={{ padding: 20 }}>
      {state.status === 'open' ? (
        <Card>
          <Title>✅ WhatsApp linked</Title>
          <Text style={{ color: colors.secondary, fontSize: 14, lineHeight: 21 }}>
            Open WhatsApp and message yourself (the "Note to Self" chat, or search your own number).{'\n\n'}
            • "Guzman 11.8" → logs Food{'\n'}
            • "grab 14.5" → logs Transport{'\n'}
            • "sws 20 groceries" → spends from your SWS fund (not counted in monthly spending){'\n'}
            • "nsws 50" → tops the SWS fund back up{'\n'}
            • Reply to a logged message to correct it, or reply "delete" to remove it.{'\n\n'}
            The bot reacts with ✅ when an expense is logged. It only ever reads your Note to Self chat.
          </Text>
          <Button title="Unlink" kind="danger" onPress={unlink} style={{ marginTop: 16 }} />
        </Card>
      ) : (
        <>
          <Card>
            <Title>Link with phone number</Title>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
              Best when WhatsApp is on this same phone. Enter your number with country code, then in WhatsApp go to
              Settings → Linked Devices → Link a Device → "Link with phone number instead" and type the code.
            </Text>
            <Label>Phone number (with country code)</Label>
            <Field value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="6591234567" />
            <ErrorText>{error || state.error}</ErrorText>
            <Button title={state.pairing_code ? 'Get a new code' : 'Get pairing code'} onPress={() => start(true)} loading={starting} disabled={!phone.trim()} />
            {state.pairing_code && (
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <Text style={{ color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: 6, fontVariant: ['tabular-nums'] }}>
                  {state.pairing_code}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                  Enter this in WhatsApp within about a minute — codes expire quickly.
                  {'\n'}If it fails, tap "Get a new code" and try again.
                </Text>
              </View>
            )}
          </Card>

          <Card>
            <Title>Or scan a QR code</Title>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
              Use this if WhatsApp is on a different phone: WhatsApp → Linked Devices → Link a Device.
            </Text>
            {!state.qr && <Button title="Show QR code" kind="ghost" onPress={() => start(false)} loading={starting} />}
            {state.qr && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 10 }}>
                  <Image source={{ uri: state.qr }} style={{ width: 240, height: 240 }} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Refreshes automatically — scan with WhatsApp</Text>
              </View>
            )}
          </Card>

          {state.status === 'connecting' && (
            <Text style={{ color: colors.muted, textAlign: 'center' }}>Connecting…</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}
