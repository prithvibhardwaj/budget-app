import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/stats', label: 'Statistics' },
  { to: '/settings', label: 'Settings' },
];

export default function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)', marginBottom: 24, paddingLeft: 8 }}>
          💰 Budget
        </div>
        {NAV.map(({ to, label }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: isActive ? 600 : 400,
            background: isActive ? 'var(--accent-dim)' : 'transparent',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          })}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main style={{ flex: 1, padding: '32px 28px', overflowY: 'auto', maxWidth: 1100 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
