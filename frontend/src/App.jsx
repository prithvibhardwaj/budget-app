import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/stats', label: 'Statistics', icon: '📈' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        width: collapsed ? 52 : 200,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        padding: '20px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flexShrink: 0,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          paddingLeft: collapsed ? 0 : 6,
        }}>
          {!collapsed && (
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
              💰 Budget
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)',
              fontSize: 14, padding: '4px 7px', lineHeight: 1,
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {NAV.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            padding: '10px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: isActive ? 600 : 400,
            background: isActive ? 'var(--accent-dim)' : 'transparent',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
            justifyContent: collapsed ? 'center' : 'flex-start',
            title: label,
          })}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            {!collapsed && <span>{label}</span>}
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
