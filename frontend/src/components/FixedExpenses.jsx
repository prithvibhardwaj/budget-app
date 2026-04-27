import React from 'react';

export default function FixedExpenses({ fixed }) {
  if (!fixed?.length) return null;
  const total = fixed.filter(f => f.is_active).reduce((s, f) => s + f.amount, 0);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontWeight: 600, fontSize: 15 }}>Fixed Expenses</h3>
        <span style={{ fontWeight: 700, fontSize: 18 }}>${total.toFixed(2)}<span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>/mo</span></span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fixed.map(f => (
          <div key={f.id} style={{
            display: 'flex', justifyContent: 'space-between',
            opacity: f.is_active ? 1 : 0.4,
            padding: '8px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ color: f.is_active ? 'var(--text)' : 'var(--text-muted)' }}>{f.name}</span>
            <span style={{ fontWeight: 500 }}>${f.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
