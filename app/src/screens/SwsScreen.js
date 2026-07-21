import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, fmtMoney } from '../theme';
import { Card, Field, Button, Label, ErrorText, Segmented } from '../components/ui';

export default function SwsScreen() {
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // 'balance' | 'txn' | null
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('spend');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setData(await api('/api/sws'));
  }, []);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  function openModal(kind) {
    setAmount(kind === 'balance' && data ? String(data.balance) : '');
    setDescription('');
    setType('spend');
    setError('');
    setModal(kind);
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      if (modal === 'balance') {
        await api('/api/sws/balance', { method: 'PUT', body: { balance: Number(amount) } });
      } else {
        await api('/api/sws/txn', { method: 'POST', body: { type, amount: Number(amount), description } });
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function deleteTxn(txn) {
    Alert.alert('Delete', 'Delete this transaction? The balance will be restored.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api(`/api/sws/txn/${txn.id}`, { method: 'DELETE' }); load(); } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <FlatList
        data={data?.transactions || []}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            <Card>
              <Text style={{ color: colors.muted, fontSize: 13 }}>SWS fund balance</Text>
              <Text style={{ color: colors.ink, fontSize: 34, fontWeight: '700', marginVertical: 2 }}>
                {fmtMoney(data?.balance, data?.currency)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
                Completely separate from monthly spending. Text "sws 20 groceries" to spend from it, "nsws 50" to top it back up.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Add transaction" onPress={() => openModal('txn')} style={{ flex: 1 }} />
                <Button title="Set balance" kind="ghost" onPress={() => openModal('balance')} style={{ flex: 1 }} />
              </View>
            </Card>
            {(data?.transactions || []).length > 0 && (
              <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>History</Text>
            )}
          </>
        }
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>No SWS transactions yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => deleteTxn(item)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8 }}
          >
            <Ionicons
              name={item.type === 'spend' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
              size={20}
              color={item.type === 'spend' ? colors.secondary : colors.good}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 14 }} numberOfLines={1}>{item.description || item.type}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{item.date}</Text>
            </View>
            <Text style={{ color: item.type === 'spend' ? colors.ink : colors.good, fontSize: 14, fontVariant: ['tabular-nums'] }}>
              {item.type === 'spend' ? '−' : '+'}{fmtMoney(item.amount_home)}
            </Text>
          </Pressable>
        )}
      />

      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20 }}>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600', marginBottom: 14 }}>
              {modal === 'balance' ? 'Set SWS balance' : 'SWS transaction'}
            </Text>
            {modal === 'txn' && (
              <Segmented
                options={[{ label: 'Spend', value: 'spend' }, { label: 'Top up', value: 'refund' }]}
                value={type}
                onChange={setType}
              />
            )}
            <Label>Amount</Label>
            <Field value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
            {modal === 'txn' && (
              <>
                <Label>Description</Label>
                <Field value={description} onChangeText={setDescription} placeholder="Optional" />
              </>
            )}
            <ErrorText>{error}</ErrorText>
            <Button title="Save" onPress={save} loading={busy} />
            <Button title="Cancel" kind="ghost" onPress={() => setModal(null)} style={{ marginTop: 8, marginBottom: 10 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
