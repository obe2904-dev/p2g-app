// components/dashboard/Card.tsx
'use client';

import type { CSSProperties, ReactNode } from 'react';

type CardProps = {
  /** Lille grå titel øverst i kortet (valgfri) */
  title?: ReactNode;
  /** Højre-justeret område i headeren (fx knapper/filtre) (valgfri) */
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
};

export default function Card({ title, right, children, style }: CardProps) {
  return (
    <section style={{ ...cardStyle, ...style }}>
      {(title || right) && (
        <div style={headerStyle}>
          {title ? <div style={cardTitle}>{title}</div> : <span />}
          {right ? <div>{right}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export const cardStyle: CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
};

export const cardTitle: CSSProperties = {
  fontSize: 12,
  color: '#666',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 6,
};
