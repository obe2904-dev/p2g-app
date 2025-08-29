'use client';
import React from 'react';

export type Suggestion = {
  id: string;
  title: string;
  subtitle?: string;
  category: 'cropping' | 'cleaning' | 'color';
  tag: 'cropping' | 'cleaning' | 'color';
  excludes?: string[];
};

type Props = {
  items: Suggestion[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

const tagLabel: Record<Suggestion['tag'], string> = {
  cropping: 'Beskæring',
  cleaning: 'Rengøring',
  color: 'Farver & lys',
};

export default function PhotoSuggestions({ items, selected, onToggle }: Props) {
  return (
    <div style={wrap}>
      <ul style={list}>
        {items.map((it) => {
          const isOn = selected.has(it.id);
          return (
            <li key={it.id} style={{ listStyle: 'none' }}>
              <button
                type="button"
                onClick={() => onToggle(it.id)}
                aria-pressed={isOn}
                style={{ ...rowBtn, ...(isOn ? rowActive : null) }}
              >
                {/* venstre: check + kategori */}
                <div style={left}>
                  <span
                    aria-hidden
                    style={{ ...check, ...(isOn ? checkOn : checkOff) }}
                  >
                    {isOn ? '✓' : ''}
                  </span>
                  <span style={chipSmall}>{tagLabel[it.tag]}</span>
                </div>

                {/* midte: titel + undertekst */}
                <div style={{ minWidth: 0 }}>
                  <div style={title}>{it.title}</div>
                  {it.subtitle && <div style={sub}>{it.subtitle}</div>}
                </div>

                {/* højre spacer (til evt. ikon senere) */}
                <div />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- styles ---------- */

const wrap: React.CSSProperties = {
  display: 'grid',
  gap: 8,
};

const list: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  margin: 0,
  padding: 0,
};

const rowBtn: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  gap: 10,
  alignItems: 'start',
  textAlign: 'left',
  width: '100%',
  padding: 12,
  border: '1px solid #eee',
  borderRadius: 12,
  background: '#fff',
  cursor: 'pointer',
};

const rowActive: React.CSSProperties = {
  boxShadow: 'inset 0 0 0 2px #111',
};

const left: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
};

const check: React.CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 20,
  height: 20,
  borderRadius: 999,
  border: '1px solid #ddd',
  fontSize: 12,
  lineHeight: '1',
  userSelect: 'none',
};

const checkOn: React.CSSProperties = {
  background: '#111',
  color: '#fff',
  borderColor: '#111',
};

const checkOff: React.CSSProperties = {
  background: '#fff',
  color: 'transparent',
};

const chipSmall: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 6px',
  border: '1px solid #eee',
  borderRadius: 999,
  background: '#fafafa',
  whiteSpace: 'nowrap',
};

const title: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
};

const sub: React.CSSProperties = {
  color: '#666',
  fontSize: 12,
  marginTop: 2,
};
