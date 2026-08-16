/**
 * Integrasi gerak + resolusi tumbukan.
 *
 * Modul ini sengaja tidak tahu apa-apa soal HP atau senjata. Tugasnya hanya:
 * memindahkan bola, memantulkannya, dan melaporkan benturan keras lewat
 * callback. Keputusan "benturan ini bikin damage berapa" ada di combat.js.
 */

import { ARENA, PHYSICS } from './constants.js';
import { isAlive } from './fighter.js';
import * as V from '../lib/vec.js';

/** Panjang jejak yang disimpan untuk efek motion trail. */
const TRAIL_LENGTH = 14;

/**
 * Semi-implicit Euler: kecepatan di-update dulu, baru posisi.
 * Lebih stabil daripada Euler eksplisit untuk sistem dengan gaya besar
 * seperti knockback, dan jauh lebih murah daripada RK4 yang tidak kita butuhkan.
 */
export function integrate(fighter, dt) {
  if (!isAlive(fighter)) return;

  fighter.vel.x += fighter.force.x * dt;
  fighter.vel.y += fighter.force.y * dt;

  // Damping eksponensial — frame-rate independent, tidak seperti `vel *= 0.98`.
  const damp = Math.pow(PHYSICS.linearDamping, dt);
  fighter.vel.x *= damp;
  fighter.vel.y *= damp;

  const speed = Math.hypot(fighter.vel.x, fighter.vel.y);

  // Batas kecepatan punya dua tingkat:
  //  - saat terpental (staggered) boleh melebihi `spd` sampai maxSpeed,
  //    karena justru itulah sensasi terlemparnya.
  //  - saat normal, dibatasi stat kecepatan karakter.
  const cap = fighter.staggerTimer > 0 ? PHYSICS.maxSpeed : fighter.stats.spd;
  if (speed > cap) {
    const s = cap / speed;
    fighter.vel.x *= s;
    fighter.vel.y *= s;
  }

  // Posisi langkah sebelumnya disimpan supaya renderer bisa menginterpolasi
  // di antara dua langkah fisika. Tanpa ini, layar 144Hz menampilkan langkah
  // 60Hz yang sama dua kali lalu melompat — terbaca sebagai getaran halus.
  fighter.prevPos.x = fighter.pos.x;
  fighter.prevPos.y = fighter.pos.y;

  fighter.pos.x += fighter.vel.x * dt;
  fighter.pos.y += fighter.vel.y * dt;

  // Sudut guling diakumulasi dari jarak tempuh dibagi keliling, persis seperti
  // roda menggelinding. Arahnya mengikuti komponen horizontal supaya bola yang
  // bergerak ke kiri berguling ke kiri.
  const travelled = Math.hypot(fighter.vel.x, fighter.vel.y) * dt;
  fighter.roll += (travelled / fighter.radius) * Math.sign(fighter.vel.x || 1);

  fighter.trail.push({ x: fighter.pos.x, y: fighter.pos.y });
  if (fighter.trail.length > TRAIL_LENGTH) fighter.trail.shift();
}

/** Pantulan terhadap dinding arena. */
export function resolveWalls(fighter) {
  if (!isAlive(fighter)) return;
  const r = fighter.radius;
  const e = PHYSICS.wallRestitution;

  if (fighter.pos.x - r < 0) {
    fighter.pos.x = r;
    fighter.vel.x = Math.abs(fighter.vel.x) * e;
  } else if (fighter.pos.x + r > ARENA.width) {
    fighter.pos.x = ARENA.width - r;
    fighter.vel.x = -Math.abs(fighter.vel.x) * e;
  }

  if (fighter.pos.y - r < 0) {
    fighter.pos.y = r;
    fighter.vel.y = Math.abs(fighter.vel.y) * e;
  } else if (fighter.pos.y + r > ARENA.height) {
    fighter.pos.y = ARENA.height - r;
    fighter.vel.y = -Math.abs(fighter.vel.y) * e;
  }
}

/**
 * Tumbukan bola-vs-bola dengan impuls berbasis massa.
 *
 * Ini rumus tumbukan lenting sebagian standar:
 *
 *   j = -(1 + e) * v_rel_normal / (1/m1 + 1/m2)
 *
 * Konsekuensi desainnya bagus: bola berat (Goliath + Full Plate) menghantam
 * bola ringan (Fae) akan melontarkannya jauh, sementara dirinya nyaris tidak
 * bergeser. Pemain bisa langsung membaca itu dari ukuran bolanya.
 *
 * @param {(a, b, impactSpeed: number) => void} onImpact
 *        Dipanggil untuk benturan keras; combat.js yang memutuskan damage-nya.
 */
export function resolveCollisions(list, onImpact) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!isAlive(a)) continue;

    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (!isAlive(b)) continue;

      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const minDist = a.radius + b.radius;
      const distSq = dx * dx + dy * dy;

      if (distSq >= minDist * minDist || distSq < 1e-9) continue;

      const d = Math.sqrt(distSq);
      const nx = dx / d;
      const ny = dy / d;

      // --- Koreksi posisi -------------------------------------------------
      // Tanpa ini, dua bola bisa "tenggelam" satu sama lain dan terlihat
      // menempel. `slop` menyisakan overlap mikro supaya tidak jitter.
      const penetration = minDist - d;
      const invMassA = 1 / a.mass;
      const invMassB = 1 / b.mass;
      const invSum = invMassA + invMassB;

      const correction =
        (Math.max(penetration - PHYSICS.slop, 0) / invSum) *
        PHYSICS.positionalCorrection;
      a.pos.x -= nx * correction * invMassA;
      a.pos.y -= ny * correction * invMassA;
      b.pos.x += nx * correction * invMassB;
      b.pos.y += ny * correction * invMassB;

      // --- Impuls ---------------------------------------------------------
      const rvx = b.vel.x - a.vel.x;
      const rvy = b.vel.y - a.vel.y;
      const velAlongNormal = rvx * nx + rvy * ny;

      // Sudah saling menjauh: jangan tambahkan impuls (mencegah "lengket").
      if (velAlongNormal > 0) continue;

      const impulse = (-(1 + PHYSICS.restitution) * velAlongNormal) / invSum;

      a.vel.x -= impulse * nx * invMassA;
      a.vel.y -= impulse * ny * invMassA;
      b.vel.x += impulse * nx * invMassB;
      b.vel.y += impulse * ny * invMassB;

      const impactSpeed = Math.abs(velAlongNormal);
      if (impactSpeed > PHYSICS.ramMinSpeed) {
        onImpact?.(a, b, impactSpeed);
      }
    }
  }
}

/**
 * Menambahkan impuls langsung ke kecepatan (dipakai knockback & phase step).
 * Dibagi massa supaya konsisten dengan hukum fisika di atas.
 */
export function applyImpulse(fighter, dirX, dirY, magnitude) {
  const inv = 1 / fighter.mass;
  fighter.vel.x += dirX * magnitude * inv;
  fighter.vel.y += dirY * magnitude * inv;
}

/** Titik spawn melingkar supaya tidak ada yang mulai dari posisi tidak adil. */
export function spawnPositions(count, rng) {
  const cx = ARENA.width / 2;
  const cy = ARENA.height / 2;
  const radius = Math.min(ARENA.width, ARENA.height) * 0.34;
  const offset = rng.angle();

  return Array.from({ length: count }, (_, i) => {
    const angle = offset + (i / count) * Math.PI * 2;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });
}
