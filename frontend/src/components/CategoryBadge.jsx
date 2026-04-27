import React from 'react';

export const CATEGORY_COLORS = {
  Food: '#f59e0b',
  Drinks: '#06b6d4',
  Groceries: '#22c55e',
  Laundry: '#8b5cf6',
  Entertainment: '#ec4899',
  Transport: '#3b82f6',
  Miscellaneous: '#6b7280',
};

export default function CategoryBadge({ category }) {
  const color = CATEGORY_COLORS[category] || '#6b7280';
  return (
    <span className="badge" style={{ background: color + '22', color }}>
      {category}
    </span>
  );
}
