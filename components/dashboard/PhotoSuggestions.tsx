import * as React from 'react';

export type Suggestion = {
  id: string;
  title: string;
  subtitle: string;
  category: 'cropping' | 'cleaning' | 'color';
  tag?: string;            // lille badge-tekst (fx "cropping", "cleaning", "color")
  excludes?: string[];     // gensidigt udelukkende valg
};

type Props = {
  items: Suggestion[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

export default function PhotoSuggestions({ items, selected, onToggle }: Props) {
  const total = items.length;
  const applied = selected.size;

  const badgeColor: Record<Suggestion['category'], string> = {
    cropping: '#cfe3ff',
    cleaning: '#d9f7df',
    color:    '#f0e2ff',
  };

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>AI Analysis & Suggestions</div>
        <div style={{ fontSize:14, color:'#555' }}>
          General Feedback
        </div>
        <p style={{ fontSize:14, marginTop:6 }}>
          This is a great food photo! The dessert looks delicious, but there are a few distracting
          elements. Apply one-click fixes below to make it more social-media ready.
        </p>
      </div>

      {/* Liste med forslag */}
      <div style={{ display:'grid', gap:10 }}>
        {items.map((s) => {
          const isActive = selected.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggle(s.id)}
              style={{
                textAlign:'left',
                border: isActive ? '2px solid #111' : '1px solid #e6e6e6',
                background:'#fff',
                borderRadius:12,
                padding:14,
                display:'grid',
                gap:4,
                cursor:'pointer'
              }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div
          aria-hidden
          style={{
            width:28, height:28, borderRadius:999,
            border:'1px solid #ddd', display:'grid', placeItems:'center',
            fontSize:14, background: isActive ? '#111' : '#fafafa', color:isActive ? '#fff' : '#111'
          }}
                >
                  {isActive ? '✓' : '◦'}
                </div>
                <div style={{ fontWeight:600, fontSize:14 }}>{s.title}</div>
                <span
                  style={{
                    marginLeft:'auto',
                    fontSize:11,
                    padding:'2px 8px',
                    borderRadius:999,
                    background: badgeColor[s.category],
                  }}
                >
                  {s.tag || s.category}
                </span>
              </div>
              <div style={{ marginLeft:38, fontSize:13, color:'#666' }}>{s.subtitle}</div>
            </button>
          );
        })}
      </div>

      {/* Tæller */}
      <div
        style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          borderTop:'1px solid #eee', paddingTop:8, fontSize:13, color:'#555'
        }}
      >
        <div style={{ flex:1, height:6, background:'#f3f3f3', borderRadius:999, marginRight:10 }}>
          <div style={{
            height:'100%', width: `${Math.min(100, (applied/Math.max(1,total))*100)}%`,
            background:'#111', borderRadius:999
          }} />
        </div>
        <span>Applied Suggestions {applied} / {total}</span>
      </div>
    </div>
  );
}
