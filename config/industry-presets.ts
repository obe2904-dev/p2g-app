export type IndustryKey = 'cafe' | 'frisor' | 'fysio';

type Preset = {
  title: string;
  tone: string;
  postIdeas: string[];
  hashtags: string[];
};

export const industryPresets: Record<IndustryKey, Preset> = {
  cafe: {
    title: 'Café',
    tone: 'uformel, lokal og hyggelig',
    postIdeas: [
      'Dagens kage eller frokosttilbud',
      'Ny specialty‑kaffe i baren',
      'Åbningstider og events (live musik)',
    ],
    hashtags: ['#cafe', '#kaffepause', '#hygge']
  },
  frisor: {
    title: 'Frisør',
    tone: 'personlig og professionel',
    postIdeas: [
      'Før/efter‑klip (kunde godkendt)',
      'Tip: pleje af krøller',
      'Book tid – ledige tider i denne uge',
    ],
    hashtags: ['#frisør', '#hair', '#salon']
  },
  fysio: {
    title: 'Fysioterapeut',
    tone: 'rolig, faglig og tillidsfuld',
    postIdeas: [
      'Øvelse mod ondt i nakken',
      'Kundehistorie (tilladelse indhentet)',
      'Holdtræning – ledige pladser',
    ],
    hashtags: ['#fysio', '#smertefri', '#genoptræning']
  }
};
