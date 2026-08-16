/**
 * Batu penghalang: pembangkitan, tumbukan, dan garis pandang.
 *
 * Batu diperlakukan sebagai benda bermassa TAK HINGGA. Konsekuensinya bukan
 * cuma penyederhanaan matematis — ia juga yang membuat batu terasa seperti
 * medan, bukan seperti bola raksasa: bola memantul penuh, batu tidak bergeser
 * sedikit pun.
 *
 * Bentuk visualnya poligon tidak beraturan, tapi tumbukannya tetap LINGKARAN.
 * Perbedaan itu disengaja: tumbukan poligon jauh lebih mahal dan lebih rentan
 * bug (bola nyangkut di sudut cekung), sementara secara visual selisihnya
 * beberapa piksel dan tidak pernah terasa saat main.
 */

import { ARENA, OBSTACLE } from './constants.js';
import { isAlive } from './fighter.js';
import * as V from '../lib/vec.js';

/**
 * Membuat sekumpulan batu.
 *
 * Penempatannya memakai rejection sampling: acak sebuah titik, tolak kalau
 * terlalu dekat dengan titik spawn atau batu lain, ulangi. Batasan percobaan
 * dipasang supaya arena yang penuh tidak membuat loop tak berujung — lebih
 * baik menghasilkan batu lebih sedikit daripada menggantung.
 *
 * @param {ReturnType<import('../lib/rng.js').createRng>} rng
 * @param {Array<{x:number,y:number}>} spawns titik spawn yang harus dihindari
 */
export function createObstacles(rng, spawns) {
  const [minCount, maxCount] = OBSTACLE.countRange;
  const target = rng.int(minCount, maxCount + 1);
  const [minR, maxR] = OBSTACLE.radiusRange;

  const obstacles = [];
  let attempts = 0;

  while (obstacles.length < target && attempts < target * 40) {
    attempts++;

    const radius = rng.range(minR, maxR);
    const pos = {
      x: rng.range(radius + 20, ARENA.width - radius - 20),
      y: rng.range(radius + 20, ARENA.height - radius - 20),
    };

    const clearOfSpawns = spawns.every(
      (s) => V.dist(s, pos) > radius + OBSTACLE.minSpacing,
    );
    if (!clearOfSpawns) continue;

    const clearOfRocks = obstacles.every(
      (o) => V.dist(o.pos, pos) > radius + o.radius + OBSTACLE.minSpacing * 0.5,
    );
    if (!clearOfRocks) continue;

    const maxHp = radius * OBSTACLE.hpPerRadius;

    obstacles.push({
      id: `rock_${obstacles.length}`,
      pos,
      radius,
      hp: maxHp,
      maxHp,
      destroyed: false,
      /** Offset radial per sudut, dipakai renderer untuk bentuk batu. */
      shape: makeShape(rng),
      /** Retakan tetap, muncul bertahap seiring HP turun. */
      cracks: makeCracks(rng),
    });
  }

  return obstacles;
}

/** Poligon tidak beraturan: 9-12 titik dengan jari-jari bervariasi. */
function makeShape(rng) {
  const points = rng.int(9, 13);
  return Array.from({ length: points }, () => rng.range(0.8, 1.0));
}

/** Garis retak yang selalu di tempat sama selama pertandingan. */
function makeCracks(rng) {
  return Array.from({ length: 5 }, () => ({
    angle: rng.angle(),
    inner: rng.range(0.1, 0.35),
    outer: rng.range(0.6, 0.95),
    skew: rng.range(-0.5, 0.5),
  }));
}

export const isStanding = (o) => !o.destroyed;

/**
 * Jarak kuadrat dari sebuah titik ke ruas garis AB.
 * Dipakai untuk tes garis pandang; versi kuadrat supaya tidak perlu sqrt.
 */
function pointToSegmentDistSq(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const lenSq = abx * abx + aby * aby;
  // Ruas berdegenerasi jadi titik (penyerang dan target berimpit).
  const t = lenSq > 1e-9 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;

  const dx = apx - abx * t;
  const dy = apy - aby * t;
  return dx * dx + dy * dy;
}

/**
 * Apakah ada garis pandang bersih dari `from` ke `to`?
 *
 * Dipakai HANYA untuk serangan jarak jauh. Serangan melee tidak dicek karena
 * jangkauannya lebih pendek daripada radius batu terkecil — kalau keduanya
 * bisa bersentuhan, tidak mungkin ada batu utuh di antaranya.
 */
export function hasLineOfSight(from, to, obstacles) {
  for (const o of obstacles) {
    if (o.destroyed) continue;
    if (pointToSegmentDistSq(o.pos, from, to) < o.radius * o.radius) return false;
  }
  return true;
}

/**
 * Menyelesaikan tumbukan bola-vs-batu.
 *
 * Karena batu bermassa tak hingga, penyelesaiannya jauh lebih sederhana
 * daripada tumbukan antar bola: dorong bola keluar sepenuhnya, lalu pantulkan
 * komponen kecepatan yang tegak lurus permukaan.
 *
 * @param {(fighter, obstacle, impactSpeed: number) => void} onImpact
 *        Dipanggil untuk benturan keras; combat.js yang memutuskan damage-nya.
 */
export function resolveObstacleCollisions(fighters, obstacles, onImpact) {
  for (const o of obstacles) {
    if (o.destroyed) continue;

    for (const f of fighters) {
      if (!isAlive(f)) continue;

      const dx = f.pos.x - o.pos.x;
      const dy = f.pos.y - o.pos.y;
      const minDist = f.radius + o.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist) continue;

      // Bola tepat di pusat batu: dorong ke arah sembarang tapi tetap (bukan
      // acak) supaya hasilnya deterministik.
      const d = Math.sqrt(distSq) || 1e-6;
      const nx = distSq < 1e-9 ? 1 : dx / d;
      const ny = distSq < 1e-9 ? 0 : dy / d;

      f.pos.x = o.pos.x + nx * minDist;
      f.pos.y = o.pos.y + ny * minDist;

      const approach = -(f.vel.x * nx + f.vel.y * ny);
      if (approach <= 0) continue;

      const j = (1 + OBSTACLE.restitution) * approach;
      f.vel.x += nx * j;
      f.vel.y += ny * j;

      if (approach > OBSTACLE.impactMinSpeed) onImpact?.(f, o, approach);
    }
  }
}

/**
 * Merusak batu. Mengembalikan true kalau batu hancur pada panggilan ini.
 */
export function damageObstacle(obstacle, amount) {
  if (obstacle.destroyed || amount <= 0) return false;
  obstacle.hp -= amount;
  if (obstacle.hp > 0) return false;
  obstacle.hp = 0;
  obstacle.destroyed = true;
  return true;
}
