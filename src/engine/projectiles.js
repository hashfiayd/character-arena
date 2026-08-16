/**
 * Proyektil — anak panah dan chakram yang benar-benar terbang.
 *
 * Sebelumnya semua serangan jarak jauh bersifat hitscan: begitu dilepas, ia
 * pasti kena. Itu membuat busur dan tongkat sihir cuma berbeda angka.
 *
 * Sekarang keduanya berbeda secara MEKANIK:
 *
 *   Busur / Chakram  -> proyektil. Tempo tinggi, tapi butuh waktu terbang,
 *                       jadi target yang bergerak bisa lolos. Panahnya juga
 *                       bisa dihalangi musuh lain atau menancap ke batu.
 *   Tongkat Sihir    -> hitscan. Lambat, tapi begitu dilepas pasti kena.
 *
 * Itu trade-off yang bisa dirasakan pemain tanpa membaca angka: satu terasa
 * seperti menembak, satu lagi terasa seperti mengunci sasaran.
 *
 * Damage dihitung SAAT DILEPAS (variance, kritikal, kekuatan penembak) tapi
 * mitigasinya baru saat mengenai. Konsekuensinya menyenangkan: panah dari
 * pemanah yang keburu mati tetap melesat dan tetap melukai.
 */

import { PROJECTILE } from './constants.js';
import { isAlive } from './fighter.js';
import * as V from '../lib/vec.js';

let nextId = 0;

/**
 * Melepas proyektil ke arah target.
 *
 * Pembidikannya memakai LEAD PARSIAL: penembak memperkirakan ke mana target
 * akan berada, tapi hanya sebagian. Kalau lead-nya sempurna, proyektil tidak
 * akan pernah meleset dan seluruh gunanya hilang. Kalau tanpa lead sama
 * sekali, target yang bergerak menyamping tidak akan pernah kena dan busur
 * jadi tidak terpakai. `PROJECTILE.leadFactor` adalah titik tengahnya.
 *
 * @param {Object} attacker
 * @param {Object} target
 * @param {{ raw: number, critical: boolean, speed: number }} spec
 */
export function spawnProjectile(attacker, target, spec, rng) {
  const toTarget = V.sub(target.pos, attacker.pos);
  const distance = V.len(toTarget);
  const travelTime = distance / spec.speed;

  const aimPoint = {
    x: target.pos.x + target.vel.x * travelTime * PROJECTILE.leadFactor,
    y: target.pos.y + target.vel.y * travelTime * PROJECTILE.leadFactor,
  };

  let dir = V.normalize(V.sub(aimPoint, attacker.pos));
  if (dir.x === 0 && dir.y === 0) return null;

  // Simpangan sudut: sumber utama meleset. Dipakai simetris (-spread..+spread)
  // supaya tidak ada bias arah yang lama-lama terlihat sebagai bug.
  if (PROJECTILE.spread > 0 && rng) {
    const offset = (rng.next() * 2 - 1) * PROJECTILE.spread;
    const cos = Math.cos(offset);
    const sin = Math.sin(offset);
    dir = { x: dir.x * cos - dir.y * sin, y: dir.x * sin + dir.y * cos };
  }

  return {
    id: `proj_${nextId++}`,
    ownerId: attacker.id,
    ownerName: attacker.name,
    teamId: attacker.teamId,
    color: attacker.color,

    // Lahir di tepi bola penembak, bukan di pusatnya — kalau di pusat,
    // proyektil terlihat menembus tubuh pemiliknya sendiri.
    pos: {
      x: attacker.pos.x + dir.x * (attacker.radius + 2),
      y: attacker.pos.y + dir.y * (attacker.radius + 2),
    },
    vel: V.scale(dir, spec.speed),

    radius: PROJECTILE.radius,
    raw: spec.raw,
    critical: spec.critical,
    knockback: attacker.stats.knockback,
    /** Sisa jarak tempuh; proyektil hilang setelah melewati jangkauannya. */
    remaining: attacker.stats.range * PROJECTILE.rangeMultiplier,
    /** Jarak yang sudah ditempuh — dipakai untuk damage falloff saat kena. */
    traveled: 0,
    /** Jangkauan nominal penembak, disalin karena penembak bisa keburu mati. */
    range: attacker.stats.range,
    trail: [],
  };
}

/**
 * Memajukan semua proyektil satu langkah.
 *
 * Urutan pengecekan disengaja: batu dulu, baru petarung. Kalau petarung
 * dicek lebih dulu, musuh yang berdiri tepat di balik batu masih bisa
 * tertembak — dan seluruh gagasan "batu jadi perlindungan" bocor.
 *
 * @param {Array} projectiles dimutasi di tempat
 * @param {(proj, fighter) => void} onFighterHit
 * @param {(proj, obstacle) => void} onObstacleHit
 */
export function updateProjectiles(
  projectiles,
  fighters,
  obstacles,
  dt,
  arena,
  { onFighterHit, onObstacleHit },
) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];

    const stepX = p.vel.x * dt;
    const stepY = p.vel.y * dt;
    const step = Math.hypot(stepX, stepY);
    p.pos.x += stepX;
    p.pos.y += stepY;
    p.remaining -= step;
    p.traveled += step;

    p.trail.push({ x: p.pos.x, y: p.pos.y });
    if (p.trail.length > PROJECTILE.trailLength) p.trail.shift();

    // Habis jangkauan atau keluar arena.
    if (
      p.remaining <= 0 ||
      p.pos.x < -20 ||
      p.pos.x > arena.width + 20 ||
      p.pos.y < -20 ||
      p.pos.y > arena.height + 20
    ) {
      projectiles.splice(i, 1);
      continue;
    }

    let consumed = false;

    for (const o of obstacles) {
      if (o.destroyed) continue;
      const r = o.radius + p.radius;
      if (V.distSq(p.pos, o.pos) > r * r) continue;
      onObstacleHit?.(p, o);
      consumed = true;
      break;
    }

    if (consumed) {
      projectiles.splice(i, 1);
      continue;
    }

    for (const f of fighters) {
      // Menembus rekan setim. Pilihan desain, bukan keterbatasan: di mode tim,
      // kalah karena panah rekan sendiri terasa seperti dicurangi, bukan
      // seperti kesalahan yang bisa dipelajari.
      if (!isAlive(f) || f.id === p.ownerId) continue;
      if (f.teamId === p.teamId) continue;

      const r = f.radius + p.radius;
      if (V.distSq(p.pos, f.pos) > r * r) continue;

      onFighterHit?.(p, f);
      consumed = true;
      break;
    }

    if (consumed) projectiles.splice(i, 1);
  }
}
