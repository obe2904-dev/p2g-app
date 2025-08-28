'use client';

import React from 'react';

export type Suggestion = {
  id: string;
  title: string;
  subtitle?: string;
  /** 'cropping' | 'cleaning' | 'color' (andre værdier tolereres, men tæller ikke med i max) */
  category: string;
  tag?: string;
  /** Id’er som er gensidigt udelukkede med dette forslag */
  excludes?: string[];
};

type Props = {
  items: Suggestion[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

export default function PhotoSuggestions({ items, selected, onToggle }: Props) {
  // --- grupper & max-logik ---
  const hasCropping = items.some(i => i.category === 'cropping');
  const hasColor   = items.some(i => i.category === 'color');
  const cleaning   = items.filter(i => i.category === 'cleaning');

  const maxSelectable =
    (hasCropping ? 1 : 0) +
    (hasColor ? 1 : 0) +
    cleaning.length; // i dit datasæt = 3

  const selectedCount = selected.size;

  const selectedInCat = (cat: string) =>
    items.filter(i => i.category === cat && selected.has(i.id));

  // Hvis vi er ved kapacitetsgrænsen, må man kun klikke ting, der "erstatter" noget
  const atCap = selectedCount >= maxSelectable;

  function isDisabled(item: Suggestion) {
    if (selected.has(item.id)) return false; // altid lov at slå fra
    if (!atCap) return false;

    // Erstatning inden for eksklusiv kategori (cropping/color) er OK, selv ved cap
    if (item.category === 'cropping' && selectedInCat('cropping').length >= 1) return false;
    if (item.category === 'color'    && selectedInCat('color').length    >= 1) return false;

    // Cleaning har ikke “erstatning” (alle kan vælges op til max), så når cap er nået -> disable
    return true;
  }

  // — visning: grupperet i de tre sektioner (samme rækkefølge som din Figma)
  const groups: Array<{ key: string; title: string; items: Suggestion[] }> = [
    { key: 'cropping', title: 'Beskæring & komposition', items: items.filter(i => i.category === 'cropping') },
    { key: 'cleaning', title: 'Rengøring',               items: items.filter(i => i.category === 'cleaning') },
    { key: 'color',    title: 'Farver & lys',            items: items.filter(i => i.category === 'color') },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Header m. tæller */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600 }}>AI-forslag (foto)</div>
        <div style={{ fontSize: 12, color: '#666' }}>
          Valgt <strong>{selectedCount}</strong> / {maxSelectable}{' '}
          <span style={{ marginLeft: 6, color: '#999' }}>
            (1 crop + {cleaning.length} rengøringer + 1 farvelook)
          </span>
        </div>
      </div>

      {groups.map(group => (
        <section key={group.key} style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#666' }}>{group.title}</div>
          <div
            style={{
              display: 'grid',
              gap: 8,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              alignItems: 'stretch',
            }}
          >
            {group.items.map(item => {
              const active = selected.has(item.id);
              const disabled = isDisabled(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !disabled && onToggle(item.id)}
                  disabled={disabled}
                  aria-pressed={active}
                  style={{
                    textAlign: 'left',
                    border: '1px solid ' + (active ? '#111' : '#eee'),
                    borderRadius: 12,
                    background: active ? '#f7f7f7' : '#fff',
                    padding: 12,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.55 : 1,
                    position: 'relative',
                    transition: 'border-color 120ms, background 120ms, opacity 120ms',
                    minHeight: 86,
                  }}
                >
                  {/* Checkmark når valgt */}
                  {active && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        border: '1px solid #111',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 14,
                        background: '#111',
                        color: '#fff',
                      }}
                    >
                      ✓
                    </span>
                  )}

                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
                  {item.subtitle && (
                    <div style={{ fontSize: 12, color: '#666' }}>{item.subtitle}</div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* Lille help-tekst */}
      <div style={{ fontSize: 12, color: '#666' }}>
        Tip: Formater er gensidigt udelukkende (vælg ét). Farvelooks er også enten/eller.
        Rengøringsforslag kan kombineres.
      </div>
    </div>
  );
}
