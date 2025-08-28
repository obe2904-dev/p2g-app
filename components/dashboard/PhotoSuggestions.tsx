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

  /** Ny: kort prosa-intro over listen */
  summary?: string;

  /** Ny: knap i bunden til at generere AI-preview */
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  applyBusy?: boolean;
};

export default function PhotoSuggestions({
  items,
  selected,
  onToggle,
  summary,
  onApply,
  applyLabel = 'Generér preview',
  applyDisabled,
  applyBusy,
}: Props) {
  const count = selected.size;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Prosa-intro */}
      {summary && (
        <div
          style={{
            padding: 10,
            border: '1px solid #eee',
            borderRadius: 8,
            background: '#fafafa',
            fontSize: 13,
            color: '#333',
          }}
        >
          {summary}
        </div>
      )}

      {/* Grid af forslag-kort */}
      <div
        style={{
          display: 'grid',
          gap: 10,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          alignItems: 'stretch',
        }}
      >
        {items.map((it) => {
          const isOn = selected.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggle(it.id)}
              style={{
                textAlign: 'left',
                border: isOn ? '2px solid #111' : '1px solid #eaeaea',
                background: '#fff',
                borderRadius: 10,
                padding: 12,
                cursor: 'pointer',
                position: 'relative',
                minHeight: 90,
              }}
            >
              {/* “ikon”/tjekmærke i højre top */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: '1px solid #ddd',
                  background: isOn ? '#111' : '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  color: isOn ? '#fff' : '#999',
                  fontSize: 12,
                  lineHeight: 1,
                }}
                title={isOn ? 'Valgt' : 'Vælg'}
              >
                {isOn ? '✓' : '•'}
              </div>

              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{it.title}</div>
              {it.subtitle && (
                <div style={{ fontSize: 12, color: '#666', lineHeight: 1.35 }}>{it.subtitle}</div>
              )}
              <div style={{ marginTop: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    border: '1px solid #eee',
                    background: '#fafafa',
                    padding: '2px 8px',
                    borderRadius: 999,
                    color: '#444',
                  }}
                >
                  {it.category === 'cropping'
                    ? 'Beskæring'
                    : it.category === 'cleaning'
                    ? 'Rengøring'
                    : 'Farver & lys'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer: tæller + “Generér preview” */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'center',
          borderTop: '1px solid #eee',
          paddingTop: 8,
          marginTop: 2,
        }}
      >
        <div style={{ fontSize: 12, color: '#555' }}>
          Valgt: <strong>{count}</strong>
        </div>

        {onApply && (
          <button
            type="button"
            onClick={onApply}
            disabled={!!applyDisabled || !!applyBusy}
            style={{
              padding: '8px 10px',
              border: '1px solid #111',
              background: applyDisabled ? '#f2f2f2' : '#111',
              color: applyDisabled ? '#999' : '#fff',
              borderRadius: 8,
              cursor: applyDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {applyBusy ? 'Genererer…' : applyLabel}
          </button>
        )}
      </div>
    </div>
  );
}
