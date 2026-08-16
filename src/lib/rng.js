/**
 * Seeded RNG (mulberry32).
 *
 * Kenapa tidak `Math.random()`?
 * 1. Simulasi jadi DETERMINISTIK: seed yang sama -> pertarungan yang sama persis.
 *    Ini penting untuk debugging ("kenapa si A menang terus?") dan untuk fitur
 *    replay/share-seed nanti.
 * 2. Bisa di-test. Unit test physics/combat butuh output yang reproducible.
 *
 * Trade-off: kualitas statistik mulberry32 lebih rendah dari crypto RNG, tapi
 * untuk game logic ini lebih dari cukup dan sangat cepat.
 */

/**
 * @param {number} seed
 * @returns {{ next: () => number, range: (min: number, max: number) => number,
 *             int: (minInc: number, maxExc: number) => number,
 *             pick: <T>(arr: T[]) => T, chance: (p: number) => boolean,
 *             angle: () => number, seed: number }}
 */
export function createRng(seed = Date.now() >>> 0) {
  let s = seed >>> 0;

  /** float [0, 1) */
  const next = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed,
    next,
    range: (min, max) => min + next() * (max - min),
    int: (minInc, maxExc) => minInc + Math.floor(next() * (maxExc - minInc)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    angle: () => next() * Math.PI * 2,
  };
}

/** Seed acak yang enak dibaca/di-share user, mis. "K7F2QX". */
export function randomSeedString() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Mengubah string seed jadi uint32 (FNV-1a). */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
