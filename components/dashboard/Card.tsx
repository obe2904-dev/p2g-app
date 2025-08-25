'use client';
import type { CSSProperties, ReactNode } from 'react';

export default function Card({
  title,
  children,
  footer,
  style,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...cardStyle, ...style }}>
      {title && <div style={cardTitle}>{title}</div>}
      <div>{children}</div>
      {footer && <div style={{ marginTop: 8 }}>{footer}</div>}
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
};

const cardTitle: CSSProperties = {
  fontSize: 12,
  color: '#666',
  marginBottom: 6,
};
