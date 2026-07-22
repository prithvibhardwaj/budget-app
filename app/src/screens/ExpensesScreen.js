import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView } from 'react-native';
import { confirmAction, notify } from '../dialogs';
import { exportCsv } from '../exportCsv';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors, categoryColors, CATEGORIES, fmtMoney } from '../theme';
import { Card, Field, Button, Label, ErrorText, Segmented } from '../components/ui';

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function EditModal({ visible, initial, onClose, onSaved }) {
  function confirmDelete() {
    confirmAction({
      title: 'Delete expense',
      message: `Delete "${initial.description}" (${initial.amount_home.toFixed(2)})?`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await api(`/api/expenses/${initial.id}`, { method: 'DELETE' });
          onSaved();
        } catch (e) {
          setError(e.message);
        }
      },
    });
  }

  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState('');
  const [currency, setCurrency] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setAmount(initial ? String(initial.amount) : '');
      setDescription(initial?.description || '');
      setCategory(initial?.category || 'Food');
      setDate(initial?.date || new Date().toISOString().slice(0, 10));
      setCurrency(initial?.currency || user?.current_currency || user?.home_currency || 'SGD');
      setError('');
    }
  }, [visible, initial]);

  async function save() {
    setError('');
    setBusy(true);
    try {
      const body = { amount: Number(amount), description, category, date, currency };
      if (initial) await api(`/api/expenses/${initial.id}`, { method: 'PUT', body });
      else await api('/api/expenses', { method: 'POST', body });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '85%' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600', marginBottom: 14 }}>
              {initial ? 'Edit expense' : 'Add expense'}
            </Text>
            <Label>Amount</Label>
            <Field value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
            <Label>Description</Label>
            <Field value={description} onChangeText={setDescription} placeholder="What was it?" />
            <Label>Category</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
                    borderWidth: 1,
                    borderColor: category === c ? categoryColors[c] : colors.border,
                    backgroundColor: category === c ? colors.page : 'transparent',
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: categoryColors[c], marginRight: 6 }} />
                  <Text style={{ color: category === c ? colors.ink : colors.muted, fontSize: 12 }}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Label>Date (YYYY-MM-DD)</Label>
                <Field value={date} onChangeText={setDate} placeholder="2026-01-31" />
              </View>
              <View style={{ width: 110 }}>
                <Label>Currency</Label>
                <Field value={currency} onChangeText={(t) => setCurrency(t.toUpperCase())} autoCapitalize="characters" />
              </View>
            </View>
            <ErrorText>{error}</ErrorText>
            <Button title={initial ? 'Save changes' : 'Add expense'} onPress={save} loading={busy} />
            {initial && (
              <Button title="Delete this expense" kind="danger" onPress={confirmDelete} style={{ marginTop: 8 }} />
            )}
            <Button title="Cancel" kind="ghost" onPress={onClose} style={{ marginTop: 8 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ExpensesScreen() {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState({ visible: false, initial: null });
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);

  async function doExport() {
    setExporting(true);
    try {
      await exportCsv(`/api/expenses/export?month=${month}`, `expenses-${month}.csv`);
    } catch (e) {
      notify('Export failed', e.message);
    } finally {
      setExporting(false);
    }
  }

  const load = useCallback(async () => {
    setItems(await api(`/api/expenses?month=${month}`));
  }, [month]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  function toggleSelect(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function deleteSelected() {
    confirmAction({
      title: 'Delete',
      message: `Delete ${selected.size} expense(s)?`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        await api('/api/expenses/bulk-delete', { method: 'POST', body: { ids: [...selected] } });
        setSelected(new Set());
        setSelectMode(false);
        load();
      },
    });
  }

  const home = user?.home_currency || '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 10 }}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12}>
          <Text style={{ color: colors.secondary, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '600' }}>{month}</Text>
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={12}>
            <Text style={{ color: colors.secondary, fontSize: 22 }}>›</Text>
          </Pressable>
          <Pressable onPress={doExport} hitSlop={8} disabled={exporting}>
            <Ionicons
              name={exporting ? 'hourglass-outline' : 'download-outline'}
              size={20}
              color={exporting ? colors.muted : colors.secondary}
            />
          </Pressable>
          <Pressable onPress={() => { setSelectMode(!selectMode); setSelected(new Set()); }} hitSlop={8}>
            <Ionicons name={selectMode ? 'close' : 'checkbox-outline'} size={20} color={colors.secondary} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>No expenses in {month}.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => (selectMode ? toggleSelect(item.id) : setModal({ visible: true, initial: item }))}
            onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSelect(item.id); } }}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
              borderColor: selected.has(item.id) ? colors.accent : colors.border,
              padding: 12, marginBottom: 8,
            }}
          >
            {selectMode && (
              <Ionicons
                name={selected.has(item.id) ? 'checkbox' : 'square-outline'}
                size={20} color={selected.has(item.id) ? colors.accent : colors.muted}
                style={{ marginRight: 10 }}
              />
            )}
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: categoryColors[item.category] || colors.muted, marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 14 }} numberOfLines={1}>
                {item.description}{item.is_heavy ? '  ⚠️' : ''}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{item.date} · {item.category}{item.source === 'whatsapp' ? ' · WhatsApp' : ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontVariant: ['tabular-nums'] }}>
                {fmtMoney(item.amount_home, home)}
              </Text>
              {item.currency !== home && (
                <Text style={{ color: colors.muted, fontSize: 11 }}>{fmtMoney(item.amount, item.currency)}</Text>
              )}
            </View>
          </Pressable>
        )}
      />

      {selectMode && selected.size > 0 ? (
        <Pressable
          onPress={deleteSelected}
          style={{ position: 'absolute', right: 20, bottom: 24, backgroundColor: colors.danger, borderRadius: 28, paddingHorizontal: 18, height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
        >
          <Ionicons name="trash" size={18} color={colors.ink} />
          <Text style={{ color: colors.ink, fontWeight: '600' }}>{selected.size}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setModal({ visible: true, initial: null })}
          style={{ position: 'absolute', right: 20, bottom: 24, backgroundColor: colors.accent, borderRadius: 28, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={26} color={colors.ink} />
        </Pressable>
      )}

      <EditModal
        visible={modal.visible}
        initial={modal.initial}
        onClose={() => setModal({ visible: false, initial: null })}
        onSaved={() => { setModal({ visible: false, initial: null }); load(); }}
      />
    </View>
  );
}
