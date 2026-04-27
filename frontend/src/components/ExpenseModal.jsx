import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

const CATEGORY_COLORS = {
  Food: '#f59e0b', Drinks: '#06b6d4', Groceries: '#22c55e',
  Laundry: '#8b5cf6', Entertainment: '#ec4899', Transport: '#3b82f6',
  Miscellaneous: '#6b7280',
};

export default function ExpenseModal({ expenseId, onClose, onDeleted }) {
  const [expense, setExpense] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!expenseId) return;
    api.getExpense(expenseId).then(setExpense).catch(console.error);
  }, [expenseId]);

  if (!expenseId) return null;

  async function handleDelete() {
    if (!confirm('Delete this expense?')) return;
    setDeleting(true);
    await api.deleteExpense(expenseId);
    onDeleted?.();
    onClose();
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: '#00000088', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 28, width: 420, maxWidth: '90vw',
      }}>
        {!expense ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <span className="badge" style={{
                  background: (CATEGORY_COLORS[expense.category] || '#6b7280') + '22',
                  color: CATEGORY_COLORS[expense.category] || '#6b7280',
                  marginBottom: 8,
                }}>
                  {expense.category}
                </span>
                <div style={{ fontSize: 28, fontWeight: 700 }}>${expense.amount.toFixed(2)}</div>
              </div>
              <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Row label="Description" value={expense.description} />
              <Row label="Date" value={expense.date} />
              {expense.is_heavy ? <Row label="Type" value="⚠ One-time heavy expense" /> : null}
              {expense.is_sws ? <Row label="Fund" value="SWS (not in monthly total)" /> : null}

              {expense.whatsapp_note && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>Note</div>
                  <div style={{
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontStyle: 'italic',
                  }}>
                    {expense.whatsapp_note}
                  </div>
                </div>
              )}

              {expense.raw_message && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>WhatsApp message</div>
                  <div style={{
                    background: '#25d36611', border: '1px solid #25d36633',
                    borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                    fontFamily: 'monospace', fontSize: 13, color: '#25d366',
                  }}>
                    {expense.raw_message}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                marginTop: 24, width: '100%', padding: '10px',
                borderRadius: 'var(--radius-sm)', background: '#ef444422',
                color: 'var(--red)', fontWeight: 600, border: '1px solid #ef444433',
              }}
            >
              {deleting ? 'Deleting…' : 'Delete expense'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
