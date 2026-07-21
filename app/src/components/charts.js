import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { colors, fmtMoney } from '../theme';

// Bar chart: thin marks, 4px rounded tops anchored to the baseline, 2px gaps,
// selective direct label (max bar only), sparse x labels.
export function Bars({ data, width, height = 140, color = colors.accent, xLabel }) {
  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 1);
  const n = data.length;
  const labelSpace = 16;
  const plotH = height - labelSpace;
  const gap = 2;
  const barW = Math.max((width - gap * (n - 1)) / n, 1);
  const r = Math.min(4, barW / 2);
  const maxIdx = values.indexOf(Math.max(...values));

  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <View>
      <Svg width={width} height={height}>
        {data.map((d, i) => {
          const v = Number(d.value) || 0;
          const h = Math.max((v / max) * (plotH - 14), v > 0 ? 2 : 0);
          const x = i * (barW + gap);
          const y = plotH - h;
          if (h <= 0) return null;
          const rr = Math.min(r, h);
          const path = `M${x},${plotH} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + barW - rr},${y} Q${x + barW},${y} ${x + barW},${y + rr} L${x + barW},${plotH} Z`;
          return <Path key={i} d={path} fill={color} />;
        })}
        <Line x1={0} y1={plotH} x2={width} y2={plotH} stroke={colors.baseline} strokeWidth={1} />
      </Svg>
      {values[maxIdx] > 0 && (
        <Text
          style={{
            position: 'absolute',
            top: plotH - (values[maxIdx] / max) * (plotH - 14) - 16,
            left: Math.min(Math.max(maxIdx * (barW + gap) + barW / 2 - 30, 0), width - 60),
            width: 60,
            textAlign: 'center',
            color: colors.secondary,
            fontSize: 10,
            fontVariant: ['tabular-nums'],
          }}
        >
          {fmtMoney(values[maxIdx])}
        </Text>
      )}
      <View style={{ flexDirection: 'row', width }}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={{ width: barW + gap, color: colors.muted, fontSize: 9, textAlign: 'center' }}
            numberOfLines={1}
          >
            {i % labelEvery === 0 ? (xLabel ? xLabel(d, i) : d.label) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Donut: thin ring, 2° angular gaps between segments, center total.
// Handles the single-category and empty cases explicitly.
export function Donut({ data, size = 150, stroke = 20, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const segs = data.filter((d) => (Number(d.value) || 0) > 0);
  const gapDeg = segs.length > 1 ? 2 : 0;

  let angle = 0;
  const arcs = segs.map((d) => {
    const sweep = (d.value / total) * (360 - gapDeg * segs.length);
    const start = angle + gapDeg / 2;
    const end = start + sweep;
    angle = end + gapDeg / 2;
    return { ...d, start, end };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {total <= 0 && (
          <Circle cx={cx} cy={cy} r={r} stroke={colors.grid} strokeWidth={stroke} fill="none" />
        )}
        {arcs.map((a, i) => {
          if (a.end - a.start >= 359) {
            return <Circle key={i} cx={cx} cy={cy} r={r} stroke={a.color} strokeWidth={stroke} fill="none" />;
          }
          const p1 = polar(cx, cy, r, a.start);
          const p2 = polar(cx, cy, r, a.end);
          const large = a.end - a.start > 180 ? 1 : 0;
          return (
            <Path
              key={i}
              d={`M${p1.x},${p1.y} A${r},${r} 0 ${large} 1 ${p2.x},${p2.y}`}
              stroke={a.color}
              strokeWidth={stroke}
              fill="none"
            />
          );
        })}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '700' }}>{centerValue}</Text>
        {!!centerLabel && <Text style={{ color: colors.muted, fontSize: 11 }}>{centerLabel}</Text>}
      </View>
    </View>
  );
}

// Legend rows double as the data table: color mark + name + amount in text ink.
export function LegendRows({ data, currency }) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  return (
    <View style={{ flex: 1 }}>
      {data.map((d) => (
        <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: d.color, marginRight: 8 }} />
          <Text style={{ color: colors.secondary, fontSize: 13, flex: 1 }} numberOfLines={1}>{d.label}</Text>
          <Text style={{ color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'] }}>
            {fmtMoney(d.value, currency)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, width: 42, textAlign: 'right' }}>
            {total > 0 ? ` ${Math.round((d.value / total) * 100)}%` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}
