'use client';

import React, { type ReactNode, type HTMLAttributes } from 'react';

export type CardProps = {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  style?: React.CSSProperties;
  headerRight?: ReactNode; // knapper/controls i højre side af headeren
} & HTMLAttributes<HTMLDivElement>;

export default function Card({
  children,
  title,
  footer,
  style,
  headerRight,
  ...rest
}: CardProps) {
  return (
    <section
      {...rest}
      style={{
        border: '1px solid #eee',
        borderRadius: 12,
        padding: 16,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        ...style,
      }}
    >
      {(title || headerRight) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          {title && <div style={{ fontSize: 12, color: '#666' }}>{title}</div>}
          {headerRight}
        </div>
      )}

      <div>{children}</div>

      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
    </section>
  );
}
