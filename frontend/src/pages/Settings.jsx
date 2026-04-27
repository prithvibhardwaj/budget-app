import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Settings() {
  const [fixed, setFixed] = useState([]);
  const [sws, setSws] = useState(null);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [swsDelta, setSwsDelta] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [f, s] = await Promise.all([api.getFixedExpenses(), api.getSws()]);
    setFixed(f);
    setSws(s);
  };

  useEffect(() => { load(); }, []);

  async function addFixed(e) {
    e.preventDefault();
    if (!newName || !newAmount) return;
    await api.addFixedExpense(newName, parseFloat(newAmount));
    setNewName(''); setNewAmount('');
    load();
  }

  async function toggleFixed(item) {
    await api.updateFixedExpense(item.id, { is_active: item.is_active ? 0 : 1 });
    load();
  }

  async function deleteFixed(id) {
    if (!confirm('Remove this fixed expense?')) return;
    await api.deleteFixedExpense(id);
    load();
  }

  async function adjustSws(e) {
    e.preventDefault();
    const delta = parseFloat(swsDelta);
    if (isNaN(delta)) return;
    setSaving(true);
    await api.adjustSws(delta, 'Manual adjustment');
    setSwsDelta('');
    setMsg(`SWS adjusted by ${delta > 0 ? '+' : ''}$${delta.toFixed(2)}`);
    setTimeout(() => setMsg(''), 3000);
    setSaving(false);
    load();
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontWeight: 700, fontSize: 24, marginBottom: 28 }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Fixed Monthly Expenses</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {fixed.map(f => (
              <div key={f.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'var(--surface2)',
                borderRadius: 'var(--radius-sm)', opacity: f.is_active ? 1 : 0.5,
              }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{f.name}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>${f.amount.toFixed(2)}/mo</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => toggleFixed(f)}
                    style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)' }}
                  >
                    {f.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => deleteFixed(f.id)}
                    style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #ef444433', borderRadius: 6, color: 'var(--red)' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={addFixed} style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Name (e.g. Netflix)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              placeholder="Amount"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              style={{ width: 100 }}
              step="0.01"
              min="0"
            />
            <button type="submit" style={{
              padding: '8px 16px', background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--radius-sm)', fontWeight: 600,
            }}>Add</button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 4 }}>SWS Fund</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
            Current balance: <strong style={{ color: 'var(--text)' }}>${sws?.balance?.toFixed(2) ?? '…'}</strong>
          </div>
          <form onSubmit={adjustSws} style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Adjustment (e.g. +500 or -100)"
              value={swsDelta}
              onChange={e => setSwsDelta(e.target.value)}
              step="0.01"
              style={{ flex: 1 }}
            />
            <button type="submit" disabled={saving} style={{
              padding: '8px 16px', background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--radius-sm)', fontWeight: 600,
            }}>Adjust</button>
          </form>
          {msg && <div style={{ marginTop: 10, color: 'var(--green)', fontSize: 13 }}>{msg}</div>}
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 10 }}>
            Use positive values to add funds, negative to subtract. SWS expenses from WhatsApp adjust this automatically.
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>WhatsApp Bot Tips</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
            <Tip cmd="5.50 chicken rice" desc="Logs $5.50 as Food" />
            <Tip cmd="3 bubble tea drinks" desc="Logs $3 as Drinks" />
            <Tip cmd="45 grab transport" desc="Logs $45 as Transport" />
            <Tip cmd="sws 20 groceries fairprice" desc="Logs $20 from SWS fund (not in monthly total)" />
            <Tip cmd="nsws 50" desc="Refunds $50 back to SWS fund" />
            <Tip cmd="1200 hotel vacation" desc="Logged as Food/Misc + flagged as heavy expense" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tip({ cmd, desc }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
      <code style={{
        background: '#25d36611', color: '#25d366', padding: '2px 8px',
        borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap',
      }}>
        {cmd}
      </code>
      <span>{desc}</span>
    </div>
  );
}
