/**
 * Model statistik karakter — lapisan DOMAIN.
 *
 * Lapisan ini tidak tahu apa-apa soal React, canvas, maupun localStorage.
 * Isinya cuma: apa itu "stat", bagaimana modifier digabung, dan aturan
 * turunannya. Karena murni fungsi, semuanya gampang di-unit-test.
 *
 * @typedef {Object} Stats
 * @property {number} maxHp
 * @property {number} atk          Damage mentah per serangan
 * @property {number} def          Mitigasi, dipakai di formula 100/(100+def)
 * @property {number} spd          Kecepatan maksimum (unit/detik)
 * @property {number} mass         Berat: memengaruhi knockback & impuls tumbukan
 * @property {number} attackSpeed  Serangan per detik
 * @property {number} range        Jangkauan serangan (unit). 0-50 = melee, >100 = ranged
 * @property {number} crit         Peluang kritikal 0..1
 * @property {number} critMult     Pengali damage kritikal
 * @property {number} evasion      Peluang menghindar 0..1
 * @property {number} regen        HP per detik
 * @property {number} courage      0..1 — makin rendah makin cepat kabur saat sekarat
 * @property {number} aggression   0..1 — makin tinggi makin suka merapat ke lawan
 * @property {number} knockback    Pengali kekuatan dorongan yang diberikan
 * @property {number} projectileSpeed  0 = hitscan (pasti kena). >0 = proyektil
 *                                     terbang dengan kecepatan ini (bisa meleset)
 */

/** @type {Stats} */
export const BASE_STATS = Object.freeze({
  maxHp: 85,
  atk: 14,
  def: 8,
  spd: 130,
  mass: 1,
  attackSpeed: 1,
  range: 12,
  crit: 0.05,
  critMult: 1.7,
  evasion: 0,
  regen: 0,
  courage: 0.5,
  aggression: 0.5,
  knockback: 1,
  projectileSpeed: 0,
});

export const STAT_KEYS = Object.keys(BASE_STATS);

/**
 * Batas aman tiap stat. Ini yang mencegah kombinasi spin "sial banget"
 * menghasilkan karakter dengan spd 0 (diam di tempat) atau evasion 1
 * (mustahil dikalahkan) yang bikin simulasi tidak pernah selesai.
 */
const CLAMPS = {
  maxHp: [30, 600],
  atk: [3, 200],
  def: [0, 90],
  spd: [45, 400],
  mass: [0.4, 6],
  attackSpeed: [0.25, 4],
  range: [6, 320],
  crit: [0, 0.85],
  critMult: [1, 4],
  evasion: [0, 0.45],
  regen: [0, 12],
  courage: [0, 1],
  aggression: [0, 1],
  knockback: [0.2, 4],
  projectileSpeed: [0, 1400],
};

/**
 * Menerapkan modifier ke stat.
 *
 * Urutan sengaja dibuat: SEMUA `add` dulu, baru SEMUA `mul`.
 * Kalau dicampur berurutan per-slot, hasil akhirnya akan bergantung pada
 * urutan spin — spin Race dulu vs Weapon dulu akan beda hasilnya. Itu bug
 * balancing yang halus dan sangat menyebalkan untuk dilacak.
 *
 * @param {Array<{ add?: Partial<Stats>, mul?: Partial<Stats> }>} modifiers
 * @returns {Stats}
 */
export function computeStats(modifiers) {
  const acc = { ...BASE_STATS };

  for (const mod of modifiers) {
    if (!mod?.add) continue;
    for (const [key, value] of Object.entries(mod.add)) {
      if (key in acc) acc[key] += value;
    }
  }

  for (const mod of modifiers) {
    if (!mod?.mul) continue;
    for (const [key, value] of Object.entries(mod.mul)) {
      if (key in acc) acc[key] *= value;
    }
  }

  for (const [key, [min, max]] of Object.entries(CLAMPS)) {
    acc[key] = Math.min(max, Math.max(min, acc[key]));
  }

  return acc;
}

/**
 * Radius bola diturunkan dari mass, bukan stat terpisah.
 * Konsekuensinya konsisten: karakter berat = bola besar = target lebih gampang
 * kena, tapi susah didorong. Ini trade-off yang bisa dibaca pemain dari visual.
 */
export function radiusFromMass(mass) {
  return 13 + Math.pow(mass, 0.62) * 7;
}

/** Melee butuh merapat; ranged justru mati kalau merapat. */
export function isRanged(stats) {
  return stats.range >= 90;
}

/**
 * Jarak ideal yang ingin dijaga AI terhadap target.
 * Melee: sedikit lebih dekat dari range supaya serangan selalu masuk.
 * Ranged: menjaga jarak ~75% range supaya masih bisa nembak tapi tetap aman.
 */
export function preferredDistance(stats) {
  return isRanged(stats) ? stats.range * 0.72 : Math.max(stats.range * 0.85, 10);
}

/**
 * Skor kekuatan kasar — dipakai untuk menampilkan "Power" di kartu karakter
 * dan untuk seeding tim supaya tidak timpang.
 *
 * Ini heuristik, BUKAN prediksi akurat. Efektivitas nyata sangat bergantung
 * pada matchup (mis. ranged kiter vs melee lambat) yang tidak bisa diringkas
 * jadi satu angka.
 */
export function powerScore(stats) {
  const ehp = stats.maxHp * (1 + stats.def / 100) + stats.regen * 8;
  const dps =
    stats.atk * stats.attackSpeed * (1 + stats.crit * (stats.critMult - 1));
  const mobility = stats.spd / 130;
  return Math.round(Math.sqrt(ehp * dps) * (0.75 + 0.25 * mobility));
}
