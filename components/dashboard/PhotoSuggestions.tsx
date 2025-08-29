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
  color: 'Farver & lys'
};

export default function PhotoSuggestions({ items, selected, onToggle }: Props) {
  // hvor mange kan maks vælges (givet konflikter)
  const maxSelectable =
    (items.some(i => i.tag === 'cropping') ? 1 : 0) +
    (items.some(i => i.tag === 'color') ? 1 : 0) +
    items.filter(i => i.tag === 'cleaning').length;

  const applied = selected.size;

  return (
    <div style={wrap}>
      <div style={list}>
        {items.map((it) => {
          const isOn = selected.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggle(it.id)}
              style={{ ...row, ...(isOn ? rowActive : null) }}
            >
              {/* venstre: check + lille kategori-mærkat */}
              <div style={left}>
                <span
                  aria-hidden
                  style={{
                    ...check,
                    ...(isOn ? checkOn : checkOff),
                  }}
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

              {/* højre: (tom spacer – klar til ikoner senere) */}
              <div />
            </button>
          );
        })}
      </div>

      {/* sticky bund – tæller + progress */}
      <div style={stickyBar}>
        <div style={stickyLabel}>
          Valgte ændringer
          <span style={{ fontWeight: 600, marginLeft: 8 }}>{applied} / {maxSelectable}</span>
        </div>
        <div style={progressTrack}>
          <div
            style={{
              ...progressFill,
              width: `${Math.min(100, (applied / Math.max(1, maxSelectable)) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */

const wrap: React.CSSProperties = {
  // ingen fixed height her – vi lader PARENT scrolle.
  display: 'grid',
  gridTemplateRows: '1fr auto',
  gap: 8,
  minHeight: 0, // vigtige for at sticky kan virke i scroll-containeren
};

const list: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  minHeight: 0,
};

const row: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  gap: 10,
  alignItems: 'start',
  textAlign: 'left',
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

const stickyBar: React.CSSProperties = {
  position: 'sticky',
  bottom: 0,
  background: '#fff',
  paddingTop: 8,
  borderTop: '1px solid #eee',
};

const stickyLabel: React.CSSProperties = {
  fontSize: 13,
  color: '#444',
  marginBottom: 6,
};

const progressTrack: React.CSSProperties = {
  height: 8,
  background: '#f1f1f5',
  borderRadius: 999,
  overflow: 'hidden',
};

const progressFill: React.CSSProperties = {
  height: '100%',
  background: '#111',
  borderRadius: 999,
};
