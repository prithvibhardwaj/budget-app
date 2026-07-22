import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Alert, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, getRecoveryCode, saveRecoveryCode } from '../api';
import { useAuth } from '../AuthContext';
import { colors, fmtMoney } from '../theme';
import { Card, Title, Field, Button, Label, ErrorText } from '../components/ui';

export default function SettingsScreen({ navigation }) {
  const { user, refreshUser, logout } = useAuth();
  const [fixed, setFixed] = useState([]);
  const [modal, setModal] = useState(null); // {initial} for fixed expense editor
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [homeCur, setHomeCur] = useState('');
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFixed(await api('/api/fixed'));
    setRecoveryCode(await getRecoveryCode());
    await refreshUser().catch(() => {});
  }, [refreshUser]);

  function revealRecovery() {
    if (recoveryCode) { setShowCode(!showCode); return; }
    // No code stored on this device (e.g. an older email account) — mint one.
    Alert.alert('Create a recovery code', 'This lets you restore your data on another phone. Any previous code stops working.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Create', onPress: async () => {
          try {
            const { recovery_code } = await api('/api/me/recovery-code', { method: 'POST' });
            await saveRecoveryCode(recovery_code);
            setRecoveryCode(recovery_code);
            setShowCode(true);
          } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  }

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  function openFixed(initial) {
    setName(initial?.name || '');
    setAmount(initial ? String(initial.amount) : '');
    setError('');
    setModal({ initial });
  }

  async function saveFixed() {
    setError('');
    setBusy(true);
    try {
      const body = { name, amount: Number(amount) };
      if (modal.initial) await api(`/api/fixed/${modal.initial.id}`, { method: 'PUT', body });
      else await api('/api/fixed', { method: 'POST', body });
      setModal(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function deleteFixed(item) {
    Alert.alert('Delete', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api(`/api/fixed/${item.id}`, { method: 'DELETE' }); load(); } },
    ]);
  }

  function disconnectWhatsApp() {
    Alert.alert('Disconnect WhatsApp', 'The bot will stop reading your Note to Self messages. You can link again anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/me/whatsapp/unlink', { method: 'POST' });
            await refreshUser();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  async function saveCurrency() {
    try {
      await api('/api/me/settings', { method: 'PUT', body: { home_currency: homeCur } });
      setHomeCur('');
      await refreshUser();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  const fixedTotal = fixed.filter((f) => f.active).reduce((s, f) => s + f.amount, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.page }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Card>
        <Title>{user?.name}</Title>
        <View style={{ height: 4 }} />
        <Text style={{ color: colors.secondary, fontSize: 13 }}>
          Home currency: <Text style={{ color: colors.ink }}>{user?.home_currency}</Text>
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 13 }}>
          Detected location: <Text style={{ color: colors.ink }}>
            {user?.current_country ? `${user.current_country} (${user.current_currency})` : 'not detected yet'}
          </Text>
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
          Account ID: {user?.id}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <Field
            value={homeCur}
            onChangeText={(t) => setHomeCur(t.toUpperCase())}
            placeholder={user?.home_currency || 'SGD'}
            autoCapitalize="characters"
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Button title="Set home currency" kind="ghost" onPress={saveCurrency} disabled={!homeCur} />
        </View>
      </Card>

      <Card>
        <Title>Recovery code</Title>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
          There's no email or password on this account. This code is the only way to reach your data
          from another phone — keep a copy somewhere safe.
        </Text>
        {showCode && recoveryCode && (
          <View style={{ backgroundColor: colors.page, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 14, textAlign: 'center', fontFamily: 'monospace' }}>
              {recoveryCode}
            </Text>
          </View>
        )}
        <Button
          title={recoveryCode ? (showCode ? 'Hide code' : 'Show recovery code') : 'Create a recovery code'}
          kind="ghost"
          onPress={revealRecovery}
        />
        {showCode && recoveryCode && (
          <Button
            title="Share it somewhere safe"
            kind="ghost"
            onPress={() => Share.share({ message: `Budget app recovery code: ${recoveryCode}` })}
            style={{ marginTop: 8 }}
          />
        )}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Title style={{ marginBottom: 0 }}>WhatsApp</Title>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: user?.wa_linked ? colors.good : colors.muted }} />
            <Text style={{ color: colors.secondary, fontSize: 13 }}>{user?.wa_linked ? 'Linked' : 'Not linked'}</Text>
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
          Link WhatsApp, then text expenses to yourself (Note to Self). "Guzman 11.8" logs $11.80 as Food.
        </Text>
        <Button title={user?.wa_linked ? 'Manage link' : 'Link WhatsApp'} onPress={() => navigation.navigate('LinkWhatsApp')} />
        {user?.wa_linked && (
          <Button title="Disconnect WhatsApp" kind="danger" onPress={disconnectWhatsApp} style={{ marginTop: 8 }} />
        )}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Title style={{ marginBottom: 0 }}>Fixed monthly expenses</Title>
          <Text style={{ color: colors.secondary, fontSize: 13 }}>{fmtMoney(fixedTotal, user?.home_currency)}</Text>
        </View>
        {fixed.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => openFixed(f)}
            onLongPress={() => deleteFixed(f)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.grid }}
          >
            <Text style={{ color: f.active ? colors.ink : colors.muted, flex: 1, fontSize: 14 }}>{f.name}</Text>
            <Text style={{ color: colors.secondary, fontSize: 14, fontVariant: ['tabular-nums'], marginRight: 12 }}>
              {fmtMoney(f.amount)}
            </Text>
            <Pressable
              hitSlop={8}
              onPress={async () => { await api(`/api/fixed/${f.id}`, { method: 'PUT', body: { active: !f.active } }); load(); }}
            >
              <Ionicons name={f.active ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.muted} />
            </Pressable>
          </Pressable>
        ))}
        <Button title="Add fixed expense" kind="ghost" onPress={() => openFixed(null)} style={{ marginTop: 12 }} />
      </Card>

      <Button title="Log out" kind="danger" onPress={logout} style={{ marginTop: 8 }} />

      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20 }}>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600', marginBottom: 14 }}>
              {modal?.initial ? 'Edit fixed expense' : 'Add fixed expense'}
            </Text>
            <Label>Name</Label>
            <Field value={name} onChangeText={setName} placeholder="e.g. Spotify" />
            <Label>Amount per month</Label>
            <Field value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
            <ErrorText>{error}</ErrorText>
            <Button title="Save" onPress={saveFixed} loading={busy} />
            <Button title="Cancel" kind="ghost" onPress={() => setModal(null)} style={{ marginTop: 8, marginBottom: 10 }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
