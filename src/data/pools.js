/**
 * DATA LAYER — pool atribut Fantasy RPG.
 *
 * Semua "isi" game ada di file ini saja. Engine dan UI tidak pernah hard-code
 * nama Race/Class/Weapon. Kalau kamu mau ganti tema jadi sci-fi, cukup ganti
 * file ini — tidak ada satu baris pun di engine yang perlu disentuh.
 *
 * Kontrak sebuah option:
 *   id       : unik dalam satu slot (dipakai untuk serialisasi ke storage)
 *   label    : teks yang tampil di roda
 *   blurb    : deskripsi pendek untuk kartu karakter
 *   weight   : bobot DASAR kemunculan (default 1). Bobot akhir dihitung
 *              domain/weights.js dengan memperhitungkan ras & kelas.
 *   add/mul  : modifier stat (lihat domain/stats.js)
 *   effects  : daftar id efek yang di-handle engine/combat.js
 *   tags     : label untuk `gearBias` (lihat di bawah)
 *   affinity : { atribut -> -2..+2 } bias tier untuk slot bertingkat
 *   gearBias : { tag -> pengali } bias kemunculan barang
 *   rank     : khusus slot bertingkat, 0..4
 *
 * Kontrak sebuah slot:
 *   kind: 'tier'  -> slot bertingkat, dipengaruhi `affinity`
 *   attribute     -> nama atribut yang dibias (untuk kind 'tier')
 */

/**
 * Efek yang DIKENALI engine. Kalau kamu menambah id baru di sini,
 * kamu wajib menambah handler-nya di engine/combat.js — jika tidak,
 * efeknya diam-diam tidak melakukan apa-apa.
 */
export const EFFECT_IDS = Object.freeze({
  VAMPIRIC: 'vampiric',
  THORNS: 'thorns',
  BURN_AURA: 'burnAura',
  SECOND_WIND: 'secondWind',
  PHASE: 'phase',
  FRENZY: 'frenzy',
  JUGGERNAUT: 'juggernaut',
});

/**
 * Tingkatan yang dipakai ulang oleh keempat roda atribut.
 * Bobot dasarnya berbentuk lonceng: "Biasa" paling sering, "Legendaris" langka.
 * Ras dan kelas menggeser lonceng ini, bukan menggantinya.
 */
const TIERS = [
  { id: 'frail', label: 'Rapuh', rank: 0, weight: 3 },
  { id: 'weak', label: 'Lemah', rank: 1, weight: 6 },
  { id: 'common', label: 'Biasa', rank: 2, weight: 7 },
  { id: 'strong', label: 'Kuat', rank: 3, weight: 4 },
  { id: 'legendary', label: 'Legendaris', rank: 4, weight: 1.6 },
];

/** Perakit slot bertingkat, supaya keempat roda atribut konsisten bentuknya. */
function tierSlot({ id, label, hint, accent, attribute, entries }) {
  return {
    id,
    label,
    hint,
    accent,
    kind: 'tier',
    attribute,
    options: TIERS.map((tier, i) => ({
      ...tier,
      blurb: entries[i].blurb,
      ...(entries[i].add ? { add: entries[i].add } : {}),
      ...(entries[i].mul ? { mul: entries[i].mul } : {}),
    })),
  };
}

/** @type {Array<{ id: string, label: string, hint: string, accent: string, kind?: string, attribute?: string, options: Array }>} */
export const SLOTS = [
  {
    id: 'race',
    label: 'Ras',
    hint: 'Fondasi tubuh — dan penentu terbesar peluang di roda berikutnya.',
    accent: '#7dd3fc',
    options: [
      {
        id: 'human',
        label: 'Human',
        blurb: 'Serba bisa. Tidak memihak apa pun.',
        add: { atk: 2, def: 2, courage: 0.1 },
        // Sengaja tanpa affinity/gearBias: Human adalah garis dasar yang
        // membuat bias ras lain terasa sebagai penyimpangan dari sesuatu.
      },
      {
        id: 'elf',
        label: 'Elf',
        blurb: 'Gesit dan presisi, tapi rapuh.',
        mul: { spd: 1.16, maxHp: 0.88 },
        add: { crit: 0.06, evasion: 0.05 },
        affinity: { agility: 1.5, vitality: -1, might: -0.5 },
        gearBias: { ranged: 1.8, light: 1.5, heavy: 0.4 },
      },
      {
        id: 'dwarf',
        label: 'Dwarf',
        blurb: 'Pendek, padat, susah didorong.',
        mul: { maxHp: 1.22, spd: 0.86, mass: 1.35 },
        add: { def: 6 },
        affinity: { guard: 2, vitality: 1, agility: -1.5 },
        gearBias: { heavy: 2.0, ranged: 0.5, none: 0.6 },
      },
      {
        id: 'orc',
        label: 'Orc',
        blurb: 'Otot dulu, mikir belakangan.',
        mul: { atk: 1.28, maxHp: 1.12, mass: 1.25, spd: 0.95 },
        add: { courage: 0.2, aggression: 0.15 },
        affinity: { might: 2, vitality: 1, agility: -1, guard: -0.5 },
        gearBias: { heavy: 2.2, melee: 1.6, ranged: 0.35, arcane: 0.3 },
      },
      {
        id: 'undead',
        label: 'Undead',
        blurb: 'Tidak kenal takut, tidak kenal mati.',
        mul: { def: 0.85, spd: 0.94 },
        add: { regen: 1.2, courage: 0.4 },
        affinity: { vitality: 0.5, guard: 0.5, agility: -1 },
        gearBias: { cursed: 2.5, blessed: 0.3 },
      },
      {
        id: 'fae',
        label: 'Fae',
        blurb: 'Kecil, ringan, sulit disentuh.',
        mul: { mass: 0.62, spd: 1.28, maxHp: 0.86 },
        add: { evasion: 0.14 },
        affinity: { agility: 2, vitality: -1.5, guard: -1 },
        gearBias: { light: 2.0, heavy: 0.25, arcane: 1.5, none: 1.4 },
      },
      {
        id: 'goliath',
        label: 'Goliath',
        blurb: 'Bergerak seperti gunung berjalan.',
        weight: 0.7,
        mul: { mass: 1.7, maxHp: 1.26, spd: 0.82, atk: 1.1 },
        affinity: { vitality: 2, might: 1.5, guard: 1, agility: -2 },
        gearBias: { heavy: 2.5, light: 0.4, ranged: 0.4 },
      },
    ],
  },

  {
    id: 'class',
    label: 'Kelas',
    hint: 'Gaya bertarung, perilaku AI, dan bias tambahan di atas ras.',
    accent: '#c4b5fd',
    options: [
      {
        id: 'knight',
        label: 'Knight',
        blurb: 'Tembok berjalan yang tidak pernah mundur.',
        mul: { def: 1.55, maxHp: 1.2, spd: 0.9 },
        add: { courage: 0.3, aggression: 0.1 },
        affinity: { guard: 1.5, vitality: 1, agility: -0.5 },
        gearBias: { heavy: 1.6, melee: 1.5, ranged: 0.4 },
      },
      {
        id: 'berserker',
        label: 'Berserker',
        blurb: 'Makin sekarat, makin cepat memukul.',
        mul: { atk: 1.42, def: 0.7 },
        add: { courage: 0.35, aggression: 0.4 },
        effects: [EFFECT_IDS.FRENZY],
        affinity: { might: 2, guard: -1.5 },
        gearBias: { heavy: 1.8, melee: 1.6, ranged: 0.3, brutal: 1.8 },
      },
      {
        id: 'mage',
        label: 'Mage',
        blurb: 'Damage besar dari jarak aman.',
        mul: { atk: 1.32, maxHp: 0.82, def: 0.72 },
        add: { aggression: -0.25 },
        affinity: { might: 1, vitality: -1, guard: -1 },
        gearBias: { arcane: 3.0, ranged: 1.8, heavy: 0.25, melee: 0.4 },
      },
      {
        id: 'ranger',
        label: 'Ranger',
        blurb: 'Menjaga jarak dan menunggu celah.',
        mul: { spd: 1.12 },
        add: { crit: 0.1, aggression: -0.18, courage: 0.05 },
        affinity: { agility: 1, might: 0.5 },
        gearBias: { ranged: 2.6, light: 1.5, heavy: 0.4 },
      },
      {
        id: 'rogue',
        label: 'Rogue',
        blurb: 'Cepat, mematikan, gampang panik.',
        mul: { spd: 1.22, maxHp: 0.86 },
        add: { crit: 0.2, evasion: 0.08, courage: -0.15 },
        affinity: { agility: 2, vitality: -1, guard: -1 },
        gearBias: { light: 2.4, heavy: 0.3, melee: 1.2 },
      },
      {
        id: 'cleric',
        label: 'Cleric',
        blurb: 'Bertahan lama lewat pemulihan.',
        mul: { maxHp: 1.18, def: 1.22, atk: 0.9 },
        add: { regen: 2.0 },
        affinity: { vitality: 1, guard: 1, might: -1 },
        gearBias: { blessed: 2.5, cursed: 0.4, arcane: 1.4 },
      },
      {
        id: 'juggernaut',
        label: 'Juggernaut',
        blurb: 'Tidak bisa dihentikan dorongan apa pun.',
        weight: 0.8,
        mul: { maxHp: 1.2, mass: 1.3, spd: 0.88 },
        effects: [EFFECT_IDS.JUGGERNAUT],
        affinity: { vitality: 2, guard: 1.5, agility: -1.5 },
        gearBias: { heavy: 2.2, light: 0.4, none: 0.5 },
      },
    ],
  },

  tierSlot({
    id: 'vitality',
    label: 'Vitalitas',
    hint: 'Seberapa banyak pukulan yang sanggup ditahan.',
    accent: '#4ade80',
    attribute: 'vitality',
    entries: [
      { blurb: 'Tubuh serapuh kaca.', mul: { maxHp: 0.7 } },
      { blurb: 'Mudah tumbang.', mul: { maxHp: 0.85 } },
      { blurb: 'Ketahanan sewajarnya.' },
      { blurb: 'Sulit dijatuhkan.', mul: { maxHp: 1.2 } },
      { blurb: 'Nyaris tidak bisa mati.', mul: { maxHp: 1.38 }, add: { maxHp: 10 } },
    ],
  }),

  tierSlot({
    id: 'might',
    label: 'Kekuatan',
    hint: 'Besarnya damage tiap serangan.',
    accent: '#f87171',
    attribute: 'might',
    entries: [
      { blurb: 'Pukulannya nyaris tidak terasa.', mul: { atk: 0.72 } },
      { blurb: 'Serangan lemah.', mul: { atk: 0.86 } },
      { blurb: 'Kekuatan sewajarnya.' },
      { blurb: 'Tiap ayunan menyakitkan.', mul: { atk: 1.18 } },
      { blurb: 'Satu pukulan mengubah pertandingan.', mul: { atk: 1.4 }, add: { crit: 0.05 } },
    ],
  }),

  tierSlot({
    id: 'guard',
    label: 'Ketahanan',
    hint: 'Mitigasi damage yang masuk.',
    accent: '#fcd34d',
    attribute: 'guard',
    entries: [
      { blurb: 'Semua serangan terasa penuh.', add: { def: -5 } },
      { blurb: 'Pertahanan tipis.', add: { def: -2 } },
      { blurb: 'Pertahanan sewajarnya.' },
      { blurb: 'Menahan pukulan dengan tenang.', add: { def: 7 }, mul: { mass: 1.05 } },
      { blurb: 'Serangan memantul begitu saja.', add: { def: 16 }, mul: { mass: 1.12 } },
    ],
  }),

  tierSlot({
    id: 'agility',
    label: 'Kelincahan',
    hint: 'Kecepatan bergerak dan menghindar.',
    accent: '#38bdf8',
    attribute: 'agility',
    entries: [
      { blurb: 'Bergerak seperti terseret.', mul: { spd: 0.8 } },
      { blurb: 'Lamban.', mul: { spd: 0.9 } },
      { blurb: 'Kecepatan sewajarnya.' },
      { blurb: 'Sulit dikepung.', mul: { spd: 1.14 }, add: { evasion: 0.06 } },
      { blurb: 'Bergerak lebih cepat dari mata.', mul: { spd: 1.3 }, add: { evasion: 0.13 } },
    ],
  }),

  {
    id: 'weapon',
    label: 'Senjata',
    hint: 'Jangkauan, tempo, dan daya dorong. Bisa juga tidak dapat apa-apa.',
    accent: '#fca5a5',
    options: [
      // Catatan balancing: senjata melee diberi DPS jauh lebih tinggi daripada
      // ranged. Itu bukan bias tema — di simulasi headless, ranged bisa
      // menjaga jarak nyaris sempurna berkat perilaku kite, jadi kalau DPS-nya
      // setara, melee tidak pernah punya alasan untuk dimainkan.
      //
      // ATURAN KERAS untuk senjata melee baru: jangkauan efektif
      // (`range` + radius kedua bola) harus setidaknya ~18 unit di atas titik
      // kontak. Restitusi tumbukan terus melempar bola menjauh beberapa unit
      // setiap benturan; jendela yang lebih sempit dari itu membuat senjata
      // nyaris tidak pernah mengenai berapa pun DPS-nya. Tangan Kosong pernah
      // tercatat 0.3% win rate dengan DPS TERTINGGI KEDUA karena kesalahan ini
      // — jendelanya cuma 8 unit.
      {
        id: 'fists',
        label: 'Tangan Kosong',
        blurb: 'Tidak dapat senjata. Cepat, tapi nyaris tanpa daya.',
        weight: 1.3,
        tags: ['none', 'light', 'melee'],
        add: { atk: 9, range: 6 },
        mul: { attackSpeed: 2.0, knockback: 0.3 },
      },
      {
        id: 'longsword',
        label: 'Longsword',
        blurb: 'Seimbang di segala situasi.',
        tags: ['melee', 'medium'],
        add: { atk: 22, range: 12, attackSpeed: 0.15 },
      },
      {
        id: 'greataxe',
        label: 'Greataxe',
        blurb: 'Lambat, tapi tiap ayunan melempar lawan.',
        tags: ['melee', 'heavy', 'brutal'],
        add: { atk: 34, range: 10 },
        mul: { attackSpeed: 0.62, knockback: 2.1 },
      },
      {
        id: 'warhammer',
        label: 'Warhammer',
        blurb: 'Dorongan paling brutal di arena.',
        tags: ['melee', 'heavy', 'brutal'],
        add: { atk: 41, range: 8 },
        mul: { attackSpeed: 0.58, knockback: 2.7 },
      },
      {
        id: 'daggers',
        label: 'Twin Daggers',
        blurb: 'Cepat sekali, dorongan hampir nol.',
        tags: ['melee', 'light'],
        add: { atk: 22, range: 8, crit: 0.15, evasion: 0.08 },
        mul: { attackSpeed: 2.2, knockback: 0.35 },
      },
      {
        id: 'spear',
        label: 'Spear',
        blurb: 'Menusuk dari luar jangkauan pedang.',
        tags: ['melee', 'medium'],
        add: { atk: 13, range: 20 },
        mul: { knockback: 1.25 },
      },
      {
        id: 'longbow',
        label: 'Longbow',
        blurb: 'Tempo tinggi, tapi panahnya terbang — target lincah bisa lolos.',
        tags: ['ranged', 'light'],
        add: { atk: 3, range: 112, projectileSpeed: 480 },
        mul: { attackSpeed: 1.25, knockback: 0.22 },
      },
      {
        id: 'staff',
        label: 'Arcane Staff',
        blurb: 'Lambat, tapi sihirnya mengunci sasaran — mustahil meleset.',
        tags: ['ranged', 'arcane', 'medium'],
        add: { atk: 20, range: 108 },
        mul: { attackSpeed: 0.5, knockback: 0.8 },
      },
      {
        id: 'chakram',
        label: 'Chakram',
        blurb: 'Jarak menengah dengan tempo tinggi.',
        weight: 0.8,
        tags: ['ranged', 'light'],
        add: { atk: 6, range: 85, crit: 0.08, projectileSpeed: 400 },
        mul: { attackSpeed: 1.4, knockback: 0.28 },
      },
    ],
  },

  {
    id: 'armor',
    label: 'Zirah',
    hint: 'Trade-off klasik: proteksi versus mobilitas.',
    accent: '#fbbf24',
    options: [
      {
        id: 'bare',
        label: 'Tanpa Zirah',
        blurb: 'Tidak dapat zirah. Tanpa beban, tanpa perlindungan.',
        weight: 1.3,
        tags: ['none', 'light'],
        add: { evasion: 0.09 },
        mul: { spd: 1.16, mass: 0.82 },
      },
      {
        id: 'plate',
        label: 'Full Plate',
        blurb: 'Nyaris kebal, tapi lamban.',
        tags: ['heavy'],
        add: { def: 13 },
        mul: { spd: 0.84, mass: 1.4 },
      },
      {
        id: 'chainmail',
        label: 'Chainmail',
        blurb: 'Kompromi yang masuk akal.',
        tags: ['medium'],
        add: { def: 9 },
        mul: { spd: 0.93, mass: 1.15 },
      },
      {
        id: 'leather',
        label: 'Leather',
        blurb: 'Ringan dan tidak mengganggu.',
        tags: ['light'],
        add: { def: 4 },
        mul: { spd: 1.02 },
      },
      {
        id: 'robe',
        label: 'Enchanted Robe',
        blurb: 'Menguatkan sihir, bukan tubuh.',
        tags: ['arcane', 'light'],
        add: { def: 1, atk: 5 },
        mul: { spd: 1.06, mass: 0.9 },
      },
      {
        id: 'runic',
        label: 'Runic Ward',
        blurb: 'Perisai sihir yang memulihkan perlahan.',
        weight: 0.7,
        tags: ['arcane', 'medium', 'blessed'],
        add: { def: 7, regen: 1.5 },
        mul: { spd: 0.96 },
      },
    ],
  },

  {
    id: 'trait',
    label: 'Sifat',
    hint: 'Mengubah kepribadian AI, bukan cuma angka.',
    accent: '#86efac',
    options: [
      {
        id: 'bloodthirsty',
        label: 'Bloodthirsty',
        blurb: 'Selalu mengejar, tidak pernah mundur.',
        add: { aggression: 0.4, courage: 0.3 },
        mul: { atk: 1.2, maxHp: 1.1, def: 0.9 },
      },
      {
        id: 'coward',
        label: 'Coward',
        blurb: 'Kabur duluan, menyerang belakangan.',
        add: { courage: -0.45, aggression: -0.3 },
        mul: { spd: 1.2 },
      },
      {
        id: 'stoic',
        label: 'Stoic',
        blurb: 'Tidak goyah oleh apa pun.',
        add: { courage: 0.5 },
        mul: { def: 1.2, spd: 0.95, mass: 1.15 },
      },
      {
        id: 'swiftfoot',
        label: 'Swiftfoot',
        blurb: 'Susah dikepung.',
        mul: { spd: 1.26 },
        add: { evasion: 0.05 },
      },
      {
        id: 'colossal',
        label: 'Colossal',
        blurb: 'Massa jadi senjata tersendiri.',
        mul: { mass: 1.8, maxHp: 1.25, spd: 0.86, atk: 1.1 },
      },
      {
        id: 'frailgenius',
        label: 'Frail Genius',
        blurb: 'Serangan mematikan, tubuh kertas.',
        mul: { maxHp: 0.68, atk: 1.38 },
        add: { crit: 0.1 },
      },
      {
        id: 'restless',
        label: 'Restless',
        blurb: 'Tempo tinggi, damage per pukulan rendah.',
        mul: { attackSpeed: 1.35, spd: 1.1, atk: 0.88 },
      },
      {
        id: 'ironhide',
        label: 'Ironhide',
        blurb: 'Kulit sekeras batu.',
        mul: { def: 1.35, mass: 1.2, spd: 0.96 },
      },
    ],
  },

  {
    id: 'boon',
    label: 'Berkah / Kutukan',
    hint: 'Kartu liar. Bisa menyelamatkan, menjerumuskan, atau tidak datang sama sekali.',
    accent: '#f0abfc',
    options: [
      {
        id: 'none',
        label: 'Tidak Ada',
        blurb: 'Tidak dapat berkah maupun kutukan.',
        weight: 2.4,
        tags: ['none'],
      },
      {
        id: 'vampiric',
        label: 'Vampiric Thirst',
        blurb: 'Menyerap 28% damage yang berhasil masuk.',
        tags: ['cursed', 'brutal'],
        effects: [EFFECT_IDS.VAMPIRIC],
      },
      {
        id: 'thornmail',
        label: 'Thornmail',
        blurb: 'Memantulkan 30% damage ke penyerang.',
        tags: ['blessed'],
        add: { def: 3 },
        effects: [EFFECT_IDS.THORNS],
      },
      {
        id: 'emberheart',
        label: 'Emberheart',
        blurb: 'Membakar lawan yang berani mendekat.',
        tags: ['arcane', 'brutal'],
        add: { atk: 2 },
        effects: [EFFECT_IDS.BURN_AURA],
      },
      {
        id: 'blessing',
        label: 'Blessing of Dawn',
        blurb: 'Pemulihan konstan sepanjang duel.',
        tags: ['blessed'],
        add: { regen: 2.4, maxHp: 12 },
      },
      {
        id: 'phasestep',
        label: 'Phase Step',
        blurb: 'Berkedip menjauh setiap berhasil menghindar.',
        tags: ['arcane', 'light'],
        add: { evasion: 0.18, def: 3 },
        effects: [EFFECT_IDS.PHASE],
      },
      {
        id: 'cursedfortune',
        label: 'Cursed Fortune',
        blurb: 'Kritikal luar biasa, pertahanan runtuh.',
        tags: ['cursed'],
        add: { crit: 0.3, critMult: 0.4 },
        mul: { def: 0.7 },
      },
      {
        id: 'titangrip',
        label: "Titan's Grip",
        blurb: 'Setiap pukulan melontarkan lawan.',
        tags: ['brutal', 'heavy'],
        mul: { knockback: 1.9, atk: 1.05 },
      },
      {
        id: 'secondwind',
        label: 'Second Wind',
        blurb: 'Bangkit sekali di separuh HP.',
        tags: ['blessed'],
        effects: [EFFECT_IDS.SECOND_WIND],
      },
      {
        id: 'hollow',
        label: 'Hollow Curse',
        blurb: 'Kutukan murni. Semoga sisanya bagus.',
        weight: 0.6,
        tags: ['cursed'],
        mul: { maxHp: 0.85, spd: 0.92 },
        add: { atk: 3 },
      },
    ],
  },
];

/** Lookup cepat: SLOT_BY_ID.race.options, dst. */
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

/** @returns {Object | undefined} */
export function findOption(slotId, optionId) {
  return SLOT_BY_ID[slotId]?.options.find((o) => o.id === optionId);
}

/**
 * Fragmen nama supaya karakter punya identitas, bukan cuma "Fighter #3".
 * Nama dirakit dari hasil spin sehingga terasa nyambung dengan buildnya.
 */
export const NAME_PARTS = {
  first: [
    'Var', 'Kel', 'Mor', 'Thal', 'Bry', 'Zan', 'Ori', 'Dra', 'Fen', 'Ysh',
    'Gor', 'Lyr', 'Nix', 'Cal', 'Hro', 'Sev', 'Ael', 'Tor', 'Ruk', 'Ino',
  ],
  last: [
    'dros', 'mira', 'thak', 'wyn', 'gard', 'oth', 'vell', 'rune', 'skar', 'lyn',
    'grim', 'faye', 'dorn', 'ash', 'holt', 'vane',
  ],
  epithet: {
    knight: 'sang Perisai',
    berserker: 'sang Amuk',
    mage: 'sang Penenun',
    ranger: 'sang Pemburu',
    rogue: 'sang Bayangan',
    cleric: 'sang Fajar',
    juggernaut: 'sang Gunung',
  },
};
