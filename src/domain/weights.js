/**
 * Sistem bobot roda — lapisan DOMAIN.
 *
 * Ini yang membuat "ras memengaruhi peluang". Bobot sebuah pilihan tidak lagi
 * konstan; ia dihitung dari pilihan yang SUDAH keluar sebelumnya.
 *
 * Dua mekanisme, sengaja dipisah karena bentuk datanya beda:
 *
 *   affinity  -> untuk slot bertingkat (Vitalitas, Kekuatan, dst).
 *                Sebuah angka -2..+2 yang menggeser massa distribusi ke tier
 *                tinggi atau rendah. Orc punya affinity `might: +2`, jadi
 *                potongan "Legendaris" di roda Kekuatan-nya jauh lebih lebar.
 *
 *   gearBias  -> untuk slot barang (Senjata, Zirah, Berkah).
 *                Pengali per TAG, bukan per id. Goliath cukup menulis
 *                `{ heavy: 2.2, ranged: 0.4 }` tanpa perlu menyebut satu per
 *                satu nama senjatanya. Kalau kamu menambah senjata baru
 *                bertag `heavy`, semua bias yang ada langsung berlaku.
 *
 * Karena bobot menentukan lebar potongan di roda (lihat SpinWheel.jsx), apa
 * yang dilihat pemain selalu sama dengan peluang sebenarnya. Roda yang
 * potongannya sama besar tapi diam-diam berbobot beda itu menipu, dan lebih
 * buruk lagi: bikin balancing mustahil dijelaskan.
 */

import { SLOT_BY_ID } from '../data/pools.js';

/**
 * Seberapa kuat satu poin affinity menggeser distribusi tier.
 *
 * weight = base * TIER_BIAS^(affinity * (rank - tengah) / 2)
 *
 * Dengan 2.0: affinity +2 membuat tier tertinggi 4x lebih sering dan tier
 * terendah 4x lebih jarang. Cukup terasa saat memutar, tapi tidak menjamin —
 * Orc masih bisa apes dan dapat Kekuatan "Rapuh". Itu justru yang bikin
 * spinwheel menarik; kalau ras menjamin hasil, tidak ada lagi taruhannya.
 */
const TIER_BIAS = 2.0;

/**
 * Mengumpulkan bias dari semua pilihan yang sudah keluar.
 * @param {Record<string,string>} picks
 * @returns {{ affinity: Record<string, number>, gearBias: Record<string, number> }}
 */
function collectBias(picks) {
  const affinity = {};
  const gearBias = {};

  for (const [slotId, optionId] of Object.entries(picks)) {
    const option = SLOT_BY_ID[slotId]?.options.find((o) => o.id === optionId);
    if (!option) continue;

    for (const [key, value] of Object.entries(option.affinity ?? {})) {
      affinity[key] = (affinity[key] ?? 0) + value;
    }
    // Bias antar sumber DIKALIKAN, bukan dijumlahkan: Orc (heavy 2.0) yang
    // kebetulan juga Berserker (heavy 1.5) jadi 3.0. Efek menumpuk terasa
    // seperti "build ini memang ditakdirkan begitu".
    for (const [tag, value] of Object.entries(option.gearBias ?? {})) {
      gearBias[tag] = (gearBias[tag] ?? 1) * value;
    }
  }

  return { affinity, gearBias };
}

/**
 * Bobot akhir tiap opsi pada sebuah slot, mengingat pilihan sebelumnya.
 *
 * @param {{ id: string, kind?: string, attribute?: string, options: Array }} slot
 * @param {Record<string,string>} picks
 * @returns {number[]} panjangnya sama dengan slot.options
 */
export function resolveWeights(slot, picks) {
  const { affinity, gearBias } = collectBias(picks);

  return slot.options.map((option) => {
    let weight = option.weight ?? 1;

    if (slot.kind === 'tier') {
      const a = affinity[slot.attribute] ?? 0;
      const middle = (slot.options.length - 1) / 2;
      weight *= Math.pow(TIER_BIAS, (a * (option.rank - middle)) / 2);
    }

    for (const tag of option.tags ?? []) {
      if (gearBias[tag] != null) weight *= gearBias[tag];
    }

    // Lantai bobot: sekecil apa pun biasnya, tiap potongan harus tetap
    // terlihat di roda. Potongan setebal nol adalah bug visual, dan opsi yang
    // mustahil keluar lebih baik dihapus dari pool daripada disembunyikan.
    return Math.max(weight, 0.08);
  });
}

/** Peluang tiap opsi dalam 0..1, untuk ditampilkan di UI. */
export function weightsToProbabilities(weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  return total > 0 ? weights.map((w) => w / total) : weights.map(() => 0);
}

/**
 * Memilih index berdasarkan bobot yang sudah dihitung.
 * Dipisah dari `pickWeighted` lama supaya UI bisa memakai bobot yang PERSIS
 * SAMA dengan yang dipakai menggambar roda — tidak ada celah untuk keduanya
 * berbeda diam-diam.
 */
export function pickIndexByWeights(weights, rng) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}
