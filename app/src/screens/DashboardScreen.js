import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors, categoryColors, fmtMoney } from '../theme';
import { Card, Title, Segmented } from '../components/ui';
import { Bars, Donut, LegendRows } from '../components/charts';

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthName(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const chartW = width - 40 - 32; // page padding + card padding

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [overview, setOverview] = useState(null);
  const [series, setSeries] = useState(null);
  const [granularity, setGranularity] = useState('day');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const counts = { day: 30, week: 12, month: 12 };
    const [ov, se] = await Promise.all([
      api(`/api/stats/overview?month=${month}`),
      api(`/api/stats/series?granularity=${granularity}&count=${counts[granularity]}`),
    ]);
    setOverview(ov);
    setSeries(se);
  }, [month, granularity]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const cur = overview?.currency || user?.home_currency || '';
  const catData = (overview?.by_category || []).map((c) => ({
    label: c.category,
    value: c.amount,
    color: categoryColors[c.category] || colors.muted,
  }));

  // Fill the daily series so every day of the month gets a bar.
  const daysInMonth = (() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  })();
  const dailyMap = Object.fromEntries((overview?.daily || []).map((d) => [d.date, d.amount]));
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return { label: String(i + 1), value: dailyMap[`${month}-${day}`] || 0 };
  });

  const seriesData = (series?.series || []).map((s) => ({
    label: series.granularity === 'day' ? s.bucket.slice(8)
      : series.granularity === 'week' ? (s.start ? s.start.slice(5) : s.bucket)
      : s.bucket.slice(5),
    value: s.amount,
  }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12}>
          <Text style={{ color: colors.secondary, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>{monthName(month)}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={12}>
          <Text style={{ color: colors.secondary, fontSize: 22 }}>›</Text>
        </Pressable>
      </View>

      <Card>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Total spent</Text>
        <Text style={{ color: colors.ink, fontSize: 34, fontWeight: '700', marginVertical: 2 }}>
          {fmtMoney(overview?.total, cur)}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 13 }}>
          {fmtMoney(overview?.variable_total, cur)} spent + {fmtMoney(overview?.fixed_total, cur)} fixed
          {overview?.heavy_count ? `  ·  ${overview.heavy_count} heavy` : ''}
        </Text>
      </Card>

      <Card>
        <Title>Daily spending</Title>
        <Bars data={dailyData} width={chartW} color={colors.accent} />
      </Card>

      <Card>
        <Title>By category</Title>
        {catData.length === 0 ? (
          <Text style={{ color: colors.muted }}>No expenses this month yet.</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Donut data={catData} centerValue={fmtMoney(overview?.variable_total)} centerLabel={cur} />
            <LegendRows data={catData} currency="" />
          </View>
        )}
      </Card>

      <Card>
        <Title>Trend</Title>
        <Segmented
          options={[{ label: 'Daily', value: 'day' }, { label: 'Weekly', value: 'week' }, { label: 'Monthly', value: 'month' }]}
          value={granularity}
          onChange={setGranularity}
        />
        {seriesData.length === 0 ? (
          <Text style={{ color: colors.muted }}>Nothing here yet.</Text>
        ) : (
          <Bars data={seriesData} width={chartW} color={colors.accent} />
        )}
      </Card>
    </ScrollView>
  );
}
