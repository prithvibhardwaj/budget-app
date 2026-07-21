// Dark theme. Chart colors are the validated dark-surface categorical palette;
// each category keeps its slot forever (color follows the entity, never rank).
export const colors = {
  page: '#0d0d0d',
  surface: '#1a1a19',
  ink: '#ffffff',
  secondary: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  baseline: '#383835',
  border: 'rgba(255,255,255,0.10)',
  accent: '#3987e5',
  danger: '#d03b3b',
  good: '#0ca30c',
};

export const categoryColors = {
  Food: '#3987e5',
  Drinks: '#d95926',
  Groceries: '#199e70',
  Transport: '#c98500',
  Entertainment: '#d55181',
  Laundry: '#008300',
  Miscellaneous: '#9085e9',
};

export const CATEGORIES = Object.keys(categoryColors);

export function fmtMoney(n, currency) {
  const v = Number(n) || 0;
  return `${currency ? currency + ' ' : ''}${v.toFixed(2)}`;
}
