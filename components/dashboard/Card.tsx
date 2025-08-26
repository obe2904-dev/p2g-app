import type { ReactNode, CSSProperties } from 'react';

type CardProps = {
  children: ReactNode;
  title?: string;            // ← NY
  right?: ReactNode;         // ← (valgfri) fx en knap i højre side
  style?: CSSProperties;
};

export default function Card({ children, title, right, style }: CardProps) {
  return (
    <div
      style={{
        border: '1px solid #eee',
        borderRadius: 12,
        padding: 16,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        ...style,
      }}
    >
      {(title || right) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          {title && <div style={{ fontSize: 12, color: '#666' }}>{title}</div>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
