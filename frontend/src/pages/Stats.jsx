import React, { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { api } from '../api/client';
import { CATEGORY_COLORS } from '../components/CategoryBadge';

function monthKey(date) { return format(date, 'yyyy-MM'); }

const MONTHS_BACK = 12;

export default function Stats() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [yearly, setYearly] = useState([]);
  const [loading, setLoading] = useState(true);

  const month = monthKey(currentDate);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getStats(month), api.getYearlyStats()])
      .then(([s, y]) => { setStats(s); setYearly(y); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month]);

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setCurrentDate(d => subMonths(d, 1))}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}
          >←</button>
          <span style={{ fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{format(currentDate, 'MMMM yyyy')}</span>
          <button
            onClick={() => setCurrentDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}
          >→</button>
        </div>
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
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
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
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>Heavy expenses this month</div>
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

          <div className="card">
            <h3 style={{ fontWeight: 600, marginBottom: 20 }}>Monthly Breakdown (all tracked months)</h3>
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

          <div className="card">
            <h3 style={{ fontWeight: 600, marginBottom: 16 }}>All Months Table</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  {['Month', 'Daily', 'Heavy', 'Fixed', 'Grand Total'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearly.map(r => (
                  <tr key={r.month} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.month}</td>
                    <td style={{ padding: '10px 12px' }}>${(r.daily_total || 0).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', color: r.heavy_total > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                      ${(r.heavy_total || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>${r.fixedTotal.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--green)' }}>${r.grandTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
