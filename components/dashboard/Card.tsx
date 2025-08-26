// components/dashboard/Card.tsx
import type { ReactNode, CSSProperties, HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  footer?: ReactNode;
  style?: CSSProperties;
  children: ReactNode;
};

export default function Card({ title, footer, children, style, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      style={{
        border: '1px solid #eee',
        borderRadius: 12,
        padding: 16,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        ...(style || {}),
      }}
    >
      {title ? <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{title}</div> : null}
      <div>{children}</div>
      {footer ? <div style={{ marginTop: 10 }}>{footer}</div> : null}
    </div>
  );
}
