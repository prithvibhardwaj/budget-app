import React, { useState, useEffect, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { api } from '../api/client';
import { CATEGORY_COLORS } from '../components/CategoryBadge';

function monthKey(date) { return format(date, 'yyyy-MM'); }

export default function Stats() {
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [stats, setStats] = useState(null);
  const [yearly, setYearly] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getStats(selectedMonth), api.getYearlyStats()])
      .then(([s, y]) => { setStats(s); setYearly(y); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  // Build dropdown options: months with data + last 6 months
  const monthOptions = useMemo(() => {
    const set = new Set(yearly.map(r => r.month));
    const now = new Date();
    for (let i = 0; i < 6; i++) set.add(monthKey(subMonths(now, i)));
    return Array.from(set).sort().reverse();
  }, [yearly]);

  const pieData = stats
    ? Object.entries(stats.byCategory).map(([name, value]) => ({ name, value: +value.toFixed(2) }))
    : [];

  const barData = yearly.map(r => ({
    month: r.month?.slice(5) || '',
    Daily: +r.daily_total.toFixed(2),
    Heavy: +r.heavy_total.toFixed(2),
    Fixed: +r.fixedTotal.toFixed(2),
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontWeight: 700, fontSize: 24 }}>Statistics</h1>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            padding: '8px 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>
              {format(new Date(m + '-15'), 'MMMM yyyy')}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <h3 style={{ fontWeight: 600, marginBottom: 20 }}>Spending by Category</h3>
              {pieData.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={pieData.length > 1 ? 60 : 0} outerRadius={100} paddingAngle={pieData.length > 1 ? 3 : 0} dataKey="value">
                        {pieData.map(entry => (
                          <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                        formatter={(v) => [`$${v.toFixed(2)}`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {pieData.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[d.name] || '#6b7280' }} />
                        <span style={{ color: 'var(--text-muted)' }}>{d.name}</span>
                        <span style={{ fontWeight: 600 }}>${d.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Month Summary</h3>
              {!stats ? null : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SummaryRow label="Daily variable" value={stats.dailyTotal} color="var(--accent)" />
                  <SummaryRow label="Fixed costs" value={stats.fixedTotal} color="var(--text-muted)" />
                  <SummaryRow label="One-time expenses" value={stats.heavyTotal} color="var(--yellow)" />
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <SummaryRow label="Grand Total" value={stats.grandTotal} color="var(--green)" large />
                  </div>
                  {stats.heavyExpenses?.length > 0 && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>One-time expenses this month</div>
                      {stats.heavyExpenses.map(e => (
                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{e.description}</span>
                          <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>${e.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <details open>
            <summary style={{ fontWeight: 600, fontSize: 16, cursor: 'pointer', padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}>
              <span>Monthly Breakdown (all tracked months)</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>▾</span>
            </summary>
            <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none', marginTop: 0 }}>
              {barData.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                      formatter={(v) => [`$${v.toFixed(2)}`]}
                    />
                    <Legend wrapperStyle={{ color: 'var(--text-muted)', fontSize: 12 }} />
                    <Bar dataKey="Daily" stackId="a" fill="#6c63ff" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Heavy" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Fixed" stackId="a" fill="#374151" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </details>

          <details open>
            <summary style={{ fontWeight: 600, fontSize: 16, cursor: 'pointer', padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}>
              <span>All Months Table</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>▾</span>
            </summary>
            <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none', padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left', background: 'var(--surface)' }}>
                    {['Month', 'Daily', 'Heavy', 'Fixed', 'Grand Total'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yearly.map(r => (
                    <tr
                      key={r.month}
                      onClick={() => setSelectedMonth(r.month)}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: r.month === selectedMonth ? 'var(--accent-dim)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: r.month === selectedMonth ? 700 : 500, color: r.month === selectedMonth ? 'var(--accent)' : 'inherit' }}>{r.month}</td>
                      <td style={{ padding: '10px 14px' }}>${(r.daily_total || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 14px', color: r.heavy_total > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                        ${(r.heavy_total || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>${r.fixedTotal.toFixed(2)}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--green)' }}>${r.grandTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, color, large }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: large ? 700 : 500, fontSize: large ? 18 : 14, color }}>${value.toFixed(2)}</span>
    </div>
  );
}
