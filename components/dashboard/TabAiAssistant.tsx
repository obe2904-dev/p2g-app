  // -------- Foto-forslag (valgbar liste) --------
  const photoItems: Suggestion[] = useMemo(() => {
    // Platform-specifikke crop-muligheder
    const cropIG: Suggestion[] = [
      {
        id: 'crop:ig:1-1',
        title: 'Crop closer to the main subject',
        subtitle: 'Square 1:1 (1080×1080) – fills the feed evenly.',
        category: 'cropping',
        tag: 'cropping',
        excludes: ['crop:ig:4-5'],
      },
      {
        id: 'crop:ig:4-5',
        title: 'Portrait crop for more feed space',
        subtitle: 'Portrait 4:5 (1080×1350) – performs well on IG feed.',
        category: 'cropping',
        tag: 'cropping',
        excludes: ['crop:ig:1-1'],
      },
    ];
    const cropFB: Suggestion[] = [
      {
        id: 'crop:fb:4-5',
        title: 'Mobile-first portrait crop',
        subtitle: '4:5 (1080×1350) – nice on FB mobile feed.',
        category: 'cropping',
        tag: 'cropping',
        excludes: ['crop:fb:1.91-1'],
      },
      {
        id: 'crop:fb:1.91-1',
        title: 'Wide link-style crop',
        subtitle: '1.91:1 (1200×630) – classic wide look in feed.',
        category: 'cropping',
        tag: 'cropping',
        excludes: ['crop:fb:4-5'],
      },
    ];

    // Rengøring
    const cleaning: Suggestion[] = [
      {
        id: 'clean:remove-phone',
        title: 'Remove phone in top left',
        subtitle: 'The phone distracts and steals attention.',
        category: 'cleaning',
        tag: 'cleaning',
      },
      {
        id: 'clean:remove-spoon',
        title: 'Remove random spoon',
        subtitle: 'The spoon looks out of place.',
        category: 'cleaning',
        tag: 'cleaning',
      },
      {
        id: 'clean:reduce-carafe',
        title: 'Reduce water carafe visibility',
        subtitle: 'Make dessert and wine the main characters.',
        category: 'cleaning',
        tag: 'cleaning',
      },
    ];

    // Farver & lys — to presets der er gensidigt udelukkende
    const color: Suggestion[] = [
      {
        id: 'color:warm',
        title: 'Warm café tone',
        subtitle: 'Cozy, inviting “café light”.',
        category: 'color',
        tag: 'color',
        excludes: ['color:cool'],
      },
      {
        id: 'color:cool',
        title: 'Cool Nordic look',
        subtitle: 'Muted colors with a soft matte feel.',
        category: 'color',
        tag: 'color',
        excludes: ['color:warm'],
      },
    ];

    const crops = platform === 'instagram' ? cropIG : platform === 'facebook' ? cropFB : [];
    return [...crops, ...cleaning, ...color];
  }, [platform]);
