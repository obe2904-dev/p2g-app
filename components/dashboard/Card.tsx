'use client';
import * as React from 'react';

export type CardProps = {
  children: React.ReactNode;
  title?: string;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
  /** Indhold i højre side af headeren (fx knapper) */
  headerRight?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export default function Card({
  children,
  title,
  footer,
  style,
  headerRight,
  ...divProps
}: CardProps) {
  return (
    <div
      {...divProps}
      style={{
        border: '1px solid #eee',
        borderRadius: 12,
        padding: 16,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        ...style
      }}
    >
      {(title || headerRight) && (
        <div style={{ display:'flex', alignItems:'center', marginBottom: 8, gap: 8 }}>
          {title && <div style={{ fontSize: 12, color: '#666', marginBottom: 0 }}>{title}</div>}
          <div style={{ marginLeft: 'auto' }}>
            {headerRight}
          </div>
        </div>
      )}

      <div>{children}</div>

      {footer && (
        <div style={{ marginTop: 12 }}>
          {footer}
        </div>
      )}
    </div>
  );
}
