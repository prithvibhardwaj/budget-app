import React, { useState, useEffect, useCallback } from 'react';
import { format, subMonths, addMonths } from 'date-fns';
import { api } from '../api/client';
import ExpenseModal from '../components/ExpenseModal';
import FixedExpenses from '../components/FixedExpenses';
import SWSTracker from '../components/SWSTracker';
import { CATEGORY_COLORS } from '../components/CategoryBadge';

function monthKey(date) { return format(date, 'yyyy-MM'); }

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [sws, setSws] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const month = monthKey(currentDate);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exp, st, sw] = await Promise.all([
        api.getExpenses(month), api.getStats(month), api.getSws(),
      ]);
      setExpenses(exp); setStats(st); setSws(sw);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setChecked(new Set()); setSelectMode(false); }, [month]);

  const regularExpenses = expenses.filter(e => !e.is_sws && !e.is_heavy);
  const heavyExpenses = expenses.filter(e => !e.is_sws && e.is_heavy);
  const byCategory = {};
  regularExpenses.forEach(e => {
    if (!byCategory[e.category]) byCategory[e.category] = [];
    byCategory[e.category].push(e);
  });

  function toggleCheck(id) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (!checked.size) return;
    if (!confirm(`Delete ${checked.size} expense${checked.size > 1 ? 's' : ''}?`)) return;
    setDeleting(true);
    await Promise.all([...checked].map(id => api.deleteExpense(id)));
    setChecked(new Set());
    setSelectMode(false);
    setDeleting(false);
    load();
  }

  return (
    <div style={{ paddingBottom: checked.size > 0 ? 80 : 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontWeight: 700, fontSize: 24 }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectMode ? (
            <button
              onClick={() => { setSelectMode(false); setChecked(new Set()); }}
              style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13 }}
            >Cancel</button>
          ) : (
            <button
              onClick={() => setSelectMode(true)}
              style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13 }}
            >Select</button>
          )}
          <button onClick={() => setCurrentDate(d => subMonths(d, 1))}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}>←</button>
          <span style={{ fontWeight: 600, minWidth: 110, textAlign: 'center' }}>{format(currentDate, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrentDate(d => addMonths(d, 1))}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}>→</button>
        </div>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard label="Daily Expenses" value={stats.dailyTotal} color="var(--accent)" />
          <StatCard label="Fixed Costs" value={stats.fixedTotal} color="var(--text-muted)" />
          <StatCard label="One-time Expenses" value={stats.heavyTotal} color="var(--yellow)" />
          <StatCard label="Grand Total" value={stats.grandTotal} color="var(--green)" large />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading ? (
            <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading…</div>
          ) : Object.keys(byCategory).length === 0 ? (
            <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
              No expenses for {format(currentDate, 'MMMM yyyy')}.<br />
              <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>Send a WhatsApp message to log one.</span>
            </div>
          ) : (
            Object.entries(byCategory).map(([cat, items]) => (
              <CategoryGroup key={cat} category={cat} items={items}
                onClickExpense={selectMode ? null : setSelectedId}
                selectMode={selectMode} checked={checked} toggleCheck={toggleCheck} />
            ))
          )}

          {heavyExpenses.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontWeight: 600, fontSize: 15, color: 'var(--yellow)' }}>⚠ One-time / Heavy Expenses</h3>
                {selectMode && (
                  <input type="checkbox"
                    checked={heavyExpenses.every(e => checked.has(e.id))}
                    onChange={all => {
                      const allChecked = heavyExpenses.every(e => checked.has(e.id));
                      setChecked(prev => {
                        const next = new Set(prev);
                        heavyExpenses.forEach(e => allChecked ? next.delete(e.id) : next.add(e.id));
                        return next;
                      });
                    }}
                    style={{ width: 18, height: 18 }}
                  />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {heavyExpenses.map(e => (
                  <ExpenseRow key={e.id} expense={e}
                    onClick={selectMode ? null : () => setSelectedId(e.id)}
                    selectMode={selectMode} checked={checked.has(e.id)}
                    onToggle={() => toggleCheck(e.id)} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FixedExpenses fixed={stats?.fixed} />
          <SWSTracker sws={sws} onExpenseClick={selectMode ? null : setSelectedId} />
        </div>
      </div>

      <ExpenseModal expenseId={selectedId} onClose={() => setSelectedId(null)} onDeleted={load} />

      {selectMode && checked.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--red, #ef4444)', borderRadius: 'var(--radius)',
          padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 24px #0006', zIndex: 200,
        }}>
          <span style={{ color: '#fff', fontWeight: 600 }}>{checked.size} selected</span>
          <button
            onClick={deleteSelected}
            disabled={deleting}
            style={{
              background: '#fff2', border: '1px solid #fff4', borderRadius: 8,
              color: '#fff', fontWeight: 700, padding: '6px 18px', cursor: 'pointer',
            }}
          >{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, large }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: large ? 24 : 20, fontWeight: 700, color }}>${value.toFixed(2)}</div>
    </div>
  );
}

function CategoryGroup({ category, items, onClickExpense, selectMode, checked, toggleCheck }) {
  const total = items.reduce((s, e) => s + e.amount, 0);
  const allChecked = items.every(e => checked.has(e.id));

  function toggleAll() {
    items.forEach(e => {
      const inSet = checked.has(e.id);
      if (allChecked ? inSet : !inSet) toggleCheck(e.id);
    });
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectMode && (
            <input type="checkbox" checked={allChecked} onChange={toggleAll}
              style={{ width: 18, height: 18, cursor: 'pointer' }} />
          )}
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[category] || '#6b7280' }} />
          <span style={{ fontWeight: 600 }}>{category}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({items.length})</span>
        </div>
        <span style={{ fontWeight: 700 }}>${total.toFixed(2)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(e => (
          <ExpenseRow key={e.id} expense={e} onClick={onClickExpense ? () => onClickExpense(e.id) : null}
            selectMode={selectMode} checked={checked.has(e.id)} onToggle={() => toggleCheck(e.id)} />
        ))}
      </div>
    </div>
  );
}

function ExpenseRow({ expense, onClick, selectMode, checked, onToggle }) {
  return (
    <div
      onClick={selectMode ? onToggle : onClick}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', background: checked ? 'var(--accent-dim)' : 'var(--surface2)',
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        border: `1px solid ${checked ? 'var(--accent)' : 'transparent'}`,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {selectMode && (
          <input type="checkbox" checked={!!checked} onChange={onToggle}
            onClick={e => e.stopPropagation()}
            style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }} />
        )}
        <div>
          <span style={{ fontWeight: 500 }}>{expense.description}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>{expense.date}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {expense.whatsapp_note && <span style={{ fontSize: 12 }}>💬</span>}
        <span style={{ fontWeight: 600 }}>${expense.amount.toFixed(2)}</span>
      </div>
    </div>
  );
}
