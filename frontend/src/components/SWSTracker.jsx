import React from 'react';

export default function SWSTracker({ sws, onExpenseClick }) {
  if (!sws) return null;

  const pct = Math.min(100, Math.max(0, (sws.balance / 2451.03) * 100));

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontWeight: 600, fontSize: 15 }}>SWS Fund</h3>
        <span style={{ fontSize: 22, fontWeight: 700, color: sws.balance > 500 ? 'var(--green)' : 'var(--yellow)' }}>
          ${sws.balance.toFixed(2)}
        </span>
      </div>

      <div style={{ background: 'var(--surface2)', borderRadius: 99, height: 6, marginBottom: 16 }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: sws.balance > 500 ? 'var(--green)' : 'var(--yellow)',
          width: `${pct}%`, transition: 'width 0.4s',
        }} />
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
        {pct.toFixed(0)}% of starting balance ($2,451.03) remaining
      </div>

      {sws.transactions?.length > 0 && (
        <>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent SWS expenses
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sws.transactions.slice(0, 5).map(t => (
              <div
                key={t.id}
                onClick={() => onExpenseClick?.(t.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 10px', background: 'var(--surface2)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  border: '1px solid transparent',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.date} · {t.description}</span>
                <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>-${t.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
