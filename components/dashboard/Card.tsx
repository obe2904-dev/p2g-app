// components/dashboard/Card.tsx
import type { CSSProperties, ReactNode } from 'react';

export type CardProps = {
  children: ReactNode;
  title?: ReactNode;   // valgfri overskrift øverst
  footer?: ReactNode;  // valgfri footer nederst (fx knapper)
  style?: CSSProperties;
};

export default function Card({ children, title, footer, style }: CardProps) {
  return (
    <section style={{ ...baseStyle, ...style }}>
      {title ? <div style={titleStyle}>{title}</div> : null}
      <div>{children}</div>
      {footer ? <div style={footerStyle}>{footer}</div> : null}
    </section>
  );
}

const baseStyle: CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  display: 'grid',
  gap: 8,
};

const titleStyle: CSSProperties = {
  fontSize: 12,
  color: '#666',
  marginBottom: 4,
};

const footerStyle: CSSProperties = {
  marginTop: 8,
};
