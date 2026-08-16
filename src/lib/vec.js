/**
 * Vector math 2D.
 *
 * Semua fungsi di sini PURE (tidak memutasi argumen) kecuali yang diberi
 * akhiran `Mut`. Versi `Mut` dipakai di dalam loop fisika untuk menghindari
 * ribuan alokasi objek per detik — 60fps x N fighter x banyak gaya steering
 * bisa cepat membuat GC bekerja keras.
 *
 * @typedef {{ x: number, y: number }} Vec2
 */

/** @returns {Vec2} */
export const vec = (x = 0, y = 0) => ({ x, y });

/** @returns {Vec2} */
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });

/** @returns {Vec2} */
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

/** @returns {Vec2} */
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s });

/** Menambahkan `b * s` ke `a` secara in-place. */
export const addScaledMut = (a, b, s) => {
  a.x += b.x * s;
  a.y += b.y * s;
  return a;
};

export const lenSq = (a) => a.x * a.x + a.y * a.y;
export const len = (a) => Math.hypot(a.x, a.y);

/** Normalisasi aman: vektor nol tetap jadi nol, bukan NaN. */
export const normalize = (a) => {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};

/** Membatasi panjang vektor ke `max` (arah dipertahankan). */
export const limit = (a, max) => {
  const l = Math.hypot(a.x, a.y);
  if (l <= max || l < 1e-9) return { x: a.x, y: a.y };
  const s = max / l;
  return { x: a.x * s, y: a.y * s };
};

/** Rotasi 90 derajat — dipakai untuk gerak orbit/strafe. */
export const perp = (a) => ({ x: -a.y, y: a.x });

export const dot = (a, b) => a.x * b.x + a.y * b.y;

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const distSq = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/** @returns {Vec2} unit vector dari sudut radian */
export const fromAngle = (rad, mag = 1) => ({
  x: Math.cos(rad) * mag,
  y: Math.sin(rad) * mag,
});

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
