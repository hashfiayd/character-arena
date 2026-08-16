/**
 * DATA LAYER — pool atribut Fantasy RPG.
 *
 * Semua "isi" game ada di file ini saja. Engine dan UI tidak pernah hard-code
 * nama Race/Class/Weapon. Kalau kamu mau ganti tema jadi sci-fi, cukup ganti
 * file ini — tidak ada satu baris pun di engine yang perlu disentuh.
 *
 * Kontrak sebuah option:
 *   id      : unik dalam satu slot (dipakai untuk serialisasi ke storage)
 *   label   : teks yang tampil di roda
 *   blurb   : deskripsi pendek untuk kartu karakter
 *   weight  : bobot kemunculan di roda (default 1). Makin besar makin sering.
 *   add/mul : modifier stat (lihat domain/stats.js)
 *   effects : daftar id efek yang di-handle engine/combat.js
 *
 * @typedef {Object} SlotOption
 * @property {string} id
 * @property {string} label
 * @property {string} blurb
 * @property {number} [weight]
 * @property {Object} [add]
 * @property {Object} [mul]
 * @property {string[]} [effects]
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

/** @type {Array<{ id: string, label: string, hint: string, accent: string, options: SlotOption[] }>} */
export const SLOTS = [
  {
    id: 'race',
    label: 'Ras',
    hint: 'Fondasi tubuh: HP, kecepatan, dan berat dasar.',
    accent: '#7dd3fc',
    options: [
      {
        id: 'human',
        label: 'Human',
        blurb: 'Serba bisa, tanpa kelemahan mencolok.',
        add: { atk: 2, def: 2, courage: 0.1 },
      },
      {
        id: 'elf',
        label: 'Elf',
        blurb: 'Gesit dan presisi, tapi rapuh.',
        mul: { spd: 1.16, maxHp: 0.88 },
        add: { crit: 0.06, evasion: 0.05 },
      },
      {
        id: 'dwarf',
        label: 'Dwarf',
        blurb: 'Pendek, padat, susah didorong.',
        mul: { maxHp: 1.22, spd: 0.86, mass: 1.35 },
        add: { def: 6 },
      },
      {
        id: 'orc',
        label: 'Orc',
        blurb: 'Otot dulu, mikir belakangan.',
        mul: { atk: 1.28, maxHp: 1.12, mass: 1.25, spd: 0.95 },
        add: { courage: 0.2, aggression: 0.15 },
      },
      {
        id: 'undead',
        label: 'Undead',
        blurb: 'Tidak kenal takut, tidak kenal mati.',
        mul: { def: 0.85, spd: 0.94 },
        add: { regen: 1.2, courage: 0.4 },
      },
      {
        id: 'fae',
        label: 'Fae',
        blurb: 'Kecil, ringan, sulit disentuh.',
        mul: { mass: 0.62, spd: 1.28, maxHp: 0.86 },
        add: { evasion: 0.14 },
      },
      {
        id: 'goliath',
        label: 'Goliath',
        blurb: 'Bergerak seperti gunung berjalan.',
        weight: 0.7,
        mul: { mass: 1.7, maxHp: 1.35, spd: 0.82, atk: 1.1 },
      },
    ],
  },

  {
    id: 'class',
    label: 'Kelas',
    hint: 'Menentukan gaya bertarung dan perilaku AI.',
    accent: '#c4b5fd',
    options: [
      {
        id: 'knight',
        label: 'Knight',
        blurb: 'Tembok berjalan yang tidak pernah mundur.',
        mul: { def: 1.55, maxHp: 1.2, spd: 0.9 },
        add: { courage: 0.3, aggression: 0.1 },
      },
      {
        id: 'berserker',
        label: 'Berserker',
        blurb: 'Makin sekarat, makin cepat memukul.',
        mul: { atk: 1.42, def: 0.7 },
        add: { courage: 0.35, aggression: 0.4 },
        effects: [EFFECT_IDS.FRENZY],
      },
      {
        id: 'mage',
        label: 'Mage',
        blurb: 'Damage besar dari jarak aman.',
        mul: { atk: 1.32, maxHp: 0.82, def: 0.72 },
        add: { aggression: -0.25 },
      },
      {
        id: 'ranger',
        label: 'Ranger',
        blurb: 'Menjaga jarak dan menunggu celah.',
        mul: { spd: 1.12 },
        add: { crit: 0.1, aggression: -0.18, courage: 0.05 },
      },
      {
        id: 'rogue',
        label: 'Rogue',
        blurb: 'Cepat, mematikan, gampang panik.',
        mul: { spd: 1.22, maxHp: 0.86 },
        add: { crit: 0.2, evasion: 0.08, courage: -0.15 },
      },
      {
        id: 'cleric',
        label: 'Cleric',
        blurb: 'Bertahan lama lewat pemulihan.',
        mul: { maxHp: 1.18, def: 1.22, atk: 0.9 },
        add: { regen: 2.0 },
      },
      {
        id: 'juggernaut',
        label: 'Juggernaut',
        blurb: 'Tidak bisa dihentikan dorongan apa pun.',
        weight: 0.8,
        mul: { maxHp: 1.3, mass: 1.3, spd: 0.88 },
        effects: [EFFECT_IDS.JUGGERNAUT],
      },
    ],
  },

  {
    id: 'weapon',
    label: 'Senjata',
    hint: 'Menentukan jangkauan, kecepatan serang, dan kekuatan dorong.',
    accent: '#fca5a5',
    options: [
      // Catatan balancing: senjata melee diberi DPS jauh lebih tinggi daripada
      // ranged. Itu bukan bias tema — di simulasi headless, ranged bisa
      // menjaga jarak nyaris sempurna berkat perilaku kite, jadi kalau DPS-nya
      // setara, melee tidak pernah punya alasan untuk dimainkan.
      {
        id: 'longsword',
        label: 'Longsword',
        blurb: 'Seimbang di segala situasi.',
        add: { atk: 22, range: 12, attackSpeed: 0.15 },
      },
      {
        id: 'greataxe',
        label: 'Greataxe',
        blurb: 'Lambat, tapi tiap ayunan melempar lawan.',
        add: { atk: 34, range: 10 },
        mul: { attackSpeed: 0.62, knockback: 2.1 },
      },
      {
        id: 'warhammer',
        label: 'Warhammer',
        blurb: 'Dorongan paling brutal di arena.',
        add: { atk: 41, range: 8 },
        mul: { attackSpeed: 0.58, knockback: 2.7 },
      },
      {
        id: 'daggers',
        label: 'Twin Daggers',
        blurb: 'Cepat sekali, dorongan hampir nol.',
        add: { atk: 18, range: 8, crit: 0.15, evasion: 0.08 },
        mul: { attackSpeed: 2.2, knockback: 0.35 },
      },
      {
        id: 'spear',
        label: 'Spear',
        blurb: 'Menusuk dari luar jangkauan pedang.',
        add: { atk: 16, range: 20 },
        mul: { knockback: 1.25 },
      },
      {
        id: 'longbow',
        label: 'Longbow',
        blurb: 'Menembak dari seberang arena.',
        add: { atk: 8, range: 125 },
        mul: { attackSpeed: 0.88, knockback: 0.22 },
      },
      {
        id: 'staff',
        label: 'Arcane Staff',
        blurb: 'Ledakan sihir yang mendorong keras.',
        add: { atk: 10, range: 108 },
        mul: { attackSpeed: 0.68, knockback: 0.8 },
      },
      {
        id: 'chakram',
        label: 'Chakram',
        blurb: 'Jarak menengah dengan tempo tinggi.',
        weight: 0.8,
        add: { atk: 11, range: 85, crit: 0.08 },
        mul: { attackSpeed: 1.25, knockback: 0.28 },
      },
    ],
  },

  {
    id: 'armor',
    label: 'Zirah',
    hint: 'Trade-off klasik: proteksi versus mobilitas.',
    accent: '#fcd34d',
    options: [
      {
        id: 'plate',
        label: 'Full Plate',
        blurb: 'Nyaris kebal, tapi lamban.',
        add: { def: 15 },
        mul: { spd: 0.84, mass: 1.4 },
      },
      {
        id: 'chainmail',
        label: 'Chainmail',
        blurb: 'Kompromi yang masuk akal.',
        add: { def: 9 },
        mul: { spd: 0.93, mass: 1.15 },
      },
      {
        id: 'leather',
        label: 'Leather',
        blurb: 'Ringan dan tidak mengganggu.',
        add: { def: 4 },
        mul: { spd: 1.02 },
      },
      {
        id: 'robe',
        label: 'Enchanted Robe',
        blurb: 'Menguatkan sihir, bukan tubuh.',
        add: { def: 1, atk: 5 },
        mul: { spd: 1.06, mass: 0.9 },
      },
      {
        id: 'bare',
        label: 'Bare Skin',
        blurb: 'Tanpa beban, tanpa perlindungan.',
        add: { evasion: 0.09 },
        mul: { spd: 1.16, mass: 0.82 },
      },
      {
        id: 'runic',
        label: 'Runic Ward',
        blurb: 'Perisai sihir yang memulihkan perlahan.',
        weight: 0.7,
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
    hint: 'Kartu liar. Bisa menyelamatkan, bisa menjerumuskan.',
    accent: '#f0abfc',
    options: [
      {
        id: 'vampiric',
        label: 'Vampiric Thirst',
        blurb: 'Menyerap 28% damage yang berhasil masuk.',
        effects: [EFFECT_IDS.VAMPIRIC],
      },
      {
        id: 'thornmail',
        label: 'Thornmail',
        blurb: 'Memantulkan 30% damage ke penyerang.',
        add: { def: 3 },
        effects: [EFFECT_IDS.THORNS],
      },
      {
        id: 'emberheart',
        label: 'Emberheart',
        blurb: 'Membakar lawan yang berani mendekat.',
        add: { atk: 2 },
        effects: [EFFECT_IDS.BURN_AURA],
      },
      {
        id: 'blessing',
        label: 'Blessing of Dawn',
        blurb: 'Pemulihan konstan sepanjang duel.',
        add: { regen: 3, maxHp: 20 },
      },
      {
        id: 'phasestep',
        label: 'Phase Step',
        blurb: 'Berkedip menjauh setiap berhasil menghindar.',
        add: { evasion: 0.18, def: 3 },
        effects: [EFFECT_IDS.PHASE],
      },
      {
        id: 'cursedfortune',
        label: 'Cursed Fortune',
        blurb: 'Kritikal luar biasa, pertahanan runtuh.',
        add: { crit: 0.3, critMult: 0.4 },
        mul: { def: 0.7 },
      },
      {
        id: 'titangrip',
        label: "Titan's Grip",
        blurb: 'Setiap pukulan melontarkan lawan.',
        mul: { knockback: 1.9, atk: 1.05 },
      },
      {
        id: 'secondwind',
        label: 'Second Wind',
        blurb: 'Bangkit sekali di 35% HP.',
        effects: [EFFECT_IDS.SECOND_WIND],
      },
      {
        id: 'hollow',
        label: 'Hollow Curse',
        blurb: 'Kutukan murni. Semoga sisanya bagus.',
        weight: 0.6,
        mul: { maxHp: 0.85, spd: 0.92 },
        add: { atk: 3 },
      },
    ],
  },
];

/** Lookup cepat: SLOT_BY_ID.race.options, dst. */
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

/** @returns {SlotOption | undefined} */
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
