'use client';
import type { ReactNode, CSSProperties } from 'react';

export default function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        border: '1px solid #eee',
        borderRadius: 12,
        padding: 16,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

export const cardTitle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  marginBottom: 6,
};

export const bigNumber: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.1,
  marginBottom: 6,
};

export const subText: React.CSSProperties = {
  fontSize: 13,
  color: '#555',
};
