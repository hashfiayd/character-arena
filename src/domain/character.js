/**
 * Agregat DOMAIN: Character.
 *
 * Character disimpan sebagai kumpulan ID pilihan (`picks`), BUKAN sebagai stat
 * yang sudah jadi. Alasannya penting:
 *
 *   - Data di localStorage tetap kecil dan stabil.
 *   - Kalau suatu saat kamu rebalance angka di data/pools.js, semua karakter
 *     lama otomatis ikut ter-rebalance. Kalau stat-nya di-snapshot, roster lama
 *     akan "membeku" di balance versi lama dan jadi sumber bug.
 *
 * Konsekuensinya: `stats` selalu dihitung ulang lewat `hydrateCharacter()`.
 *
 * @typedef {Object} Character
 * @property {string} id
 * @property {string} name
 * @property {Record<string,string>} picks   slotId -> optionId
 * @property {string} color
 * @property {number} createdAt
 * @property {{ wins: number, battles: number, kills: number }} record
 */

import { SLOTS, SLOT_BY_ID, findOption, NAME_PARTS } from '../data/pools.js';
import { computeStats, radiusFromMass, powerScore } from './stats.js';
import { resolveWeights, pickIndexByWeights } from './weights.js';

/**
 * Palet bola. Sengaja high-chroma di atas background gelap supaya tiap fighter
 * tetap terbaca saat 8 bola bergerak cepat dan saling menimpa.
 */
export const CHARACTER_COLORS = [
  '#38bdf8', '#f472b6', '#4ade80', '#facc15', '#a78bfa',
  '#fb923c', '#2dd4bf', '#f87171', '#c084fc', '#60a5fa',
];

/** Warna tim untuk mode Team. */
export const TEAM_COLORS = ['#38bdf8', '#f87171', '#4ade80', '#facc15'];

/**
 * Menentukan hasil satu putaran roda.
 *
 * `picks` yang sudah ada ikut dilewatkan karena bobotnya bergantung padanya —
 * inilah kenapa urutan slot penting: Ras dan Kelas harus keluar lebih dulu
 * agar bias mereka sempat berlaku untuk roda-roda sesudahnya.
 *
 * @param {string} slotId
 * @param {Record<string,string>} picks pilihan yang sudah keluar sebelumnya
 */
export function spinSlot(slotId, picks, rng) {
  const slot = SLOT_BY_ID[slotId];
  if (!slot) throw new Error(`Slot tidak dikenal: ${slotId}`);

  const weights = resolveWeights(slot, picks);
  const index = pickIndexByWeights(weights, rng);
  return { index, option: slot.options[index], weights };
}

export function generateName(picks, rng) {
  const first = rng.pick(NAME_PARTS.first);
  const last = rng.pick(NAME_PARTS.last);
  const epithet = NAME_PARTS.epithet[picks.class];
  const base = `${first}${last}`;
  return epithet ? `${base} ${epithet}` : base;
}

/**
 * Membuat Character dari hasil spin lengkap.
 * @param {Record<string,string>} picks
 */
export function createCharacter(picks, rng, overrides = {}) {
  const missing = SLOTS.filter((s) => !picks[s.id]).map((s) => s.id);
  if (missing.length) {
    throw new Error(`Slot belum terisi: ${missing.join(', ')}`);
  }

  return {
    id: `chr_${Date.now().toString(36)}_${Math.floor(rng.next() * 1e6).toString(36)}`,
    name: overrides.name ?? generateName(picks, rng),
    picks: { ...picks },
    color: overrides.color ?? rng.pick(CHARACTER_COLORS),
    createdAt: Date.now(),
    record: { wins: 0, battles: 0, kills: 0 },
  };
}

/**
 * Mengubah Character (data mentah) jadi bentuk siap pakai: stat terhitung,
 * radius, daftar efek, dan opsi lengkap untuk ditampilkan di UI.
 *
 * Fungsi ini adalah SATU-SATUNYA tempat picks diterjemahkan jadi angka.
 * Engine maupun UI tidak boleh menghitung stat sendiri.
 */
export function hydrateCharacter(character) {
  const options = SLOTS.map((slot) => ({
    slot,
    option: findOption(slot.id, character.picks[slot.id]),
  })).filter((entry) => entry.option);

  const stats = computeStats(options.map((e) => e.option));
  const effects = new Set(options.flatMap((e) => e.option.effects ?? []));

  return {
    ...character,
    options,
    stats,
    effects,
    radius: radiusFromMass(stats.mass),
    power: powerScore(stats),
  };
}

/**
 * Membuat karakter acak penuh.
 *
 * Slot diproses BERURUTAN dan `picks` diisi sambil jalan, supaya bias ras &
 * kelas benar-benar berlaku. Kalau semua slot diundi sekaligus secara paralel,
 * karakter acak akan punya distribusi yang beda dari karakter hasil putar
 * manual — perbedaan halus yang akan mengacaukan analisis balance headless.
 */
export function createRandomCharacter(rng) {
  const picks = {};
  for (const slot of SLOTS) {
    picks[slot.id] = spinSlot(slot.id, picks, rng).option.id;
  }
  return createCharacter(picks, rng);
}
