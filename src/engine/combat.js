/**
 * Resolusi pertempuran: serangan, damage, knockback, dan efek khusus.
 *
 * Modul ini yang mengubah "dua bola bersentuhan" menjadi kejadian yang punya
 * konsekuensi. Semua efek dari data/pools.js di-handle di sini — kalau kamu
 * menambah EFFECT_ID baru tapi lupa file ini, efeknya tidak akan terjadi.
 */

import { COMBAT, FighterState, OBSTACLE, PHYSICS } from './constants.js';
import { EFFECT_IDS } from '../data/pools.js';
import { applyImpulse } from './physics.js';
import { hasLineOfSight, damageObstacle } from './obstacles.js';
import { hpRatio, isAlive, isEnemy } from './fighter.js';
import * as V from '../lib/vec.js';

/** Menurunkan semua timer per step. */
export function updateTimers(fighter, dt) {
  fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt);
  fighter.invulnTimer = Math.max(0, fighter.invulnTimer - dt);
  fighter.hitFlash = Math.max(0, fighter.hitFlash - dt);
  fighter.swingFlash = Math.max(0, fighter.swingFlash - dt);

  if (fighter.staggerTimer > 0) {
    fighter.staggerTimer = Math.max(0, fighter.staggerTimer - dt);
    if (fighter.staggerTimer === 0 && fighter.state === FighterState.STAGGERED) {
      fighter.state = FighterState.ACTIVE;
    }
  }
}

/** Regenerasi HP pasif. */
export function applyRegen(fighter, dt) {
  if (!isAlive(fighter) || fighter.stats.regen <= 0) return;
  const before = fighter.hp;
  fighter.hp = Math.min(fighter.maxHp, fighter.hp + fighter.stats.regen * dt);
  fighter.healed += fighter.hp - before;
}

/**
 * Kecepatan serang efektif.
 * Frenzy (Berserker) membuatnya naik seiring HP turun — karakter jadi paling
 * berbahaya justru saat hampir mati.
 */
function effectiveAttackSpeed(fighter) {
  let aps = fighter.stats.attackSpeed;
  if (fighter.effects.has(EFFECT_IDS.FRENZY)) {
    aps *= 1 + COMBAT.frenzyMaxBonus * (1 - hpRatio(fighter));
  }
  return aps;
}

/**
 * Menerapkan damage ke seorang fighter.
 * Satu-satunya jalur pengurangan HP — supaya Second Wind, statistik, dan
 * event kematian tidak pernah terlewat.
 *
 * @returns {number} damage yang benar-benar masuk
 */
export function applyDamage(target, amount, ctx, source = null, kind = 'hit') {
  if (!isAlive(target) || amount <= 0) return 0;

  const dealt = Math.min(amount, target.hp);
  target.hp -= dealt;
  target.damageTaken += dealt;
  target.hitFlash = 0.18;

  if (source) source.damageDealt += dealt;

  if (target.hp > 0) return dealt;

  // --- Second Wind ------------------------------------------------------
  if (
    !target.secondWindUsed &&
    target.effects.has(EFFECT_IDS.SECOND_WIND)
  ) {
    target.secondWindUsed = true;
    target.hp = target.maxHp * COMBAT.secondWindHpRatio;
    target.invulnTimer = 0.6;
    target.staggerTimer = 0;
    target.state = FighterState.ACTIVE;
    ctx.events.push({
      type: 'revive',
      x: target.pos.x,
      y: target.pos.y,
      color: target.color,
      name: target.name,
    });
    ctx.log(`${target.name} bangkit lewat Second Wind!`);
    return dealt;
  }

  // --- Kematian ---------------------------------------------------------
  target.hp = 0;
  target.state = FighterState.DEAD;
  target.diedAt = ctx.time;
  if (source && source !== target) {
    source.kills += 1;
    ctx.log(`${source.name} menjatuhkan ${target.name}.`);
  } else {
    ctx.log(`${target.name} tumbang.`);
  }

  ctx.events.push({
    type: 'death',
    x: target.pos.x,
    y: target.pos.y,
    color: target.color,
    radius: target.radius,
  });

  return dealt;
}

/**
 * Mendorong target menjauh dan membuatnya kehilangan kendali sesaat.
 *
 * Ini inti dari permintaan "jangan cuma berdempetan". Karena `staggerTimer`
 * mematikan steering (lihat steering.js), fighter yang terpukul benar-benar
 * meluncur mengikuti fisika sebelum bisa mengambil alih arah lagi.
 */
function applyKnockback(attacker, target, damage) {
  const dir = V.normalize(V.sub(target.pos, attacker.pos));
  if (dir.x === 0 && dir.y === 0) return;

  let magnitude =
    (COMBAT.baseKnockback + damage * COMBAT.knockbackPerDamage) *
    attacker.stats.knockback;

  if (target.effects.has(EFFECT_IDS.JUGGERNAUT)) {
    magnitude *= COMBAT.juggernautKnockbackTaken;
  }

  // Impuls tetap diberikan meski target sudah mati — mayatnya ikut terpental,
  // dan itu justru terlihat bagus.
  applyImpulse(target, dir.x, dir.y, magnitude);

  // Tapi JANGAN sentuh `state` kalau target sudah mati.
  //
  // Bug yang pernah terjadi di sini: `applyKnockback` dipanggil setelah
  // `applyDamage`, sehingga pukulan mematikan menimpa state DEAD dengan
  // STAGGERED. Hasilnya petarung ber-HP 0 yang tidak pernah dianggap mati —
  // pertandingan tidak pernah selesai lewat pertarungan, dan satu-satunya
  // yang bisa "membunuh" adalah zona. Gejalanya halus: semua senjata terlihat
  // punya total damage identik (mentok di maxHp lawan).
  if (!isAlive(target)) return;

  const stagger = Math.min(
    COMBAT.maxStagger,
    (magnitude / target.mass) * COMBAT.staggerPerImpulse,
  );
  if (stagger > target.staggerTimer) {
    target.staggerTimer = stagger;
    target.state = FighterState.STAGGERED;
  }

  // Recoil hanya untuk melee — memanah tidak seharusnya mendorong pemanah.
  if (!attacker.ranged) {
    applyImpulse(attacker, -dir.x, -dir.y, magnitude * COMBAT.attackerRecoil);
  }
}

/**
 * Pengali damage berdasarkan jarak, khusus senjata ranged.
 * Linear dari 1.0 (di `startRatio` jangkauan) ke `minMultiplier` (jangkauan penuh).
 */
function rangedFalloffMultiplier(attacker, distance) {
  const { startRatio, minMultiplier } = COMBAT.rangedFalloff;
  const ratio = distance / attacker.stats.range;
  if (ratio <= startRatio) return 1;
  const t = Math.min(1, (ratio - startRatio) / (1 - startRatio));
  return 1 + (minMultiplier - 1) * t;
}

/**
 * Mencoba melancarkan serangan. Mengembalikan true kalau serangan terjadi.
 */
export function tryAttack(attacker, target, ctx) {
  if (!isAlive(attacker) || !target || !isAlive(target)) return false;
  if (attacker.attackCooldown > 0) return false;
  if (target.invulnTimer > 0) return false;

  const reach = attacker.stats.range + attacker.radius + target.radius;
  const distance = V.dist(attacker.pos, target.pos);
  if (distance > reach) return false;

  // Garis pandang hanya berlaku untuk serangan jarak jauh. Melee tidak dicek
  // karena jangkauannya lebih pendek daripada batu terkecil — kalau dua bola
  // sanggup bersentuhan, mustahil ada batu utuh di antaranya.
  //
  // Penting: cooldown TIDAK dihanguskan saat terhalang. Kalau dihanguskan,
  // pemanah yang kebetulan berdiri di balik batu akan kehilangan seluruh
  // tempo serangnya tanpa pernah melepas satu panah pun.
  if (attacker.ranged && ctx.obstacles?.length) {
    if (!hasLineOfSight(attacker.pos, target.pos, ctx.obstacles)) return false;
  }

  attacker.attackCooldown = 1 / effectiveAttackSpeed(attacker);
  attacker.swingFlash = 0.14;

  ctx.events.push({
    type: attacker.ranged ? 'shot' : 'swing',
    from: { ...attacker.pos },
    to: { ...target.pos },
    color: attacker.color,
  });

  // --- Evasion ----------------------------------------------------------
  if (ctx.rng.chance(target.stats.evasion)) {
    ctx.events.push({
      type: 'miss',
      x: target.pos.x,
      y: target.pos.y - target.radius - 6,
    });

    // Phase Step: berhasil menghindar sekaligus berkedip menjauh.
    if (target.effects.has(EFFECT_IDS.PHASE)) {
      const away = V.normalize(V.sub(target.pos, attacker.pos));
      applyImpulse(target, away.x, away.y, COMBAT.phaseImpulse);
      ctx.events.push({
        type: 'phase',
        x: target.pos.x,
        y: target.pos.y,
        color: target.color,
      });
    }
    return true;
  }

  // --- Perhitungan damage ------------------------------------------------
  const variance = 1 + (ctx.rng.next() * 2 - 1) * COMBAT.damageVariance;
  const critical = ctx.rng.chance(attacker.stats.crit);
  let raw = attacker.stats.atk * variance;
  if (critical) raw *= attacker.stats.critMult;

  if (attacker.ranged) raw *= rangedFalloffMultiplier(attacker, distance);

  // Mitigasi hiperbolik: def tinggi memberi diminishing returns, sehingga
  // tidak ada build yang bisa mencapai kekebalan total.
  const mitigation = 100 / (100 + target.stats.def);
  const damage = raw * mitigation;

  const dealt = applyDamage(target, damage, ctx, attacker, 'attack');

  ctx.events.push({
    type: 'damage',
    x: target.pos.x,
    y: target.pos.y - target.radius - 4,
    amount: Math.round(dealt),
    critical,
    color: attacker.color,
  });

  applyKnockback(attacker, target, dealt);
  target.invulnTimer = COMBAT.invulnAfterHit;

  // --- Efek pasca-hit ----------------------------------------------------
  if (attacker.effects.has(EFFECT_IDS.VAMPIRIC) && dealt > 0) {
    const heal = dealt * COMBAT.lifestealRatio;
    const before = attacker.hp;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    attacker.healed += attacker.hp - before;
    if (attacker.hp > before) {
      ctx.events.push({
        type: 'heal',
        x: attacker.pos.x,
        y: attacker.pos.y - attacker.radius - 4,
        amount: Math.round(attacker.hp - before),
      });
    }
  }

  if (target.effects.has(EFFECT_IDS.THORNS) && dealt > 0) {
    applyDamage(attacker, dealt * COMBAT.thornsRatio, ctx, target, 'thorns');
  }

  return true;
}

/**
 * Aura api: damage berkelanjutan ke musuh yang berada terlalu dekat.
 * Dihitung O(n^2), tapi n di sini maksimal 8 — tidak perlu spatial hash.
 */
export function applyBurnAuras(list, ctx, dt) {
  for (const source of list) {
    if (!isAlive(source) || !source.effects.has(EFFECT_IDS.BURN_AURA)) continue;

    for (const other of list) {
      if (other === source || !isAlive(other) || !isEnemy(source, other)) continue;

      const reach = source.radius + other.radius + COMBAT.burnAuraRadius;
      if (V.distSq(source.pos, other.pos) > reach * reach) continue;

      applyDamage(other, COMBAT.burnAuraDps * dt, ctx, source, 'burn');
      if (ctx.rng.chance(dt * 6)) {
        ctx.events.push({
          type: 'ember',
          x: other.pos.x + (ctx.rng.next() - 0.5) * other.radius,
          y: other.pos.y + (ctx.rng.next() - 0.5) * other.radius,
        });
      }
    }
  }
}

/**
 * Damage dari tabrakan fisik keras (bukan serangan bersenjata).
 *
 * Efek desainnya: bola berat yang terlempar oleh Warhammer bisa menabrak
 * bola lain dan ikut melukainya. Ini membuat knockback terasa punya
 * konsekuensi taktis, bukan sekadar kosmetik.
 */
export function applyRamDamage(a, b, impactSpeed, ctx) {
  // Hanya kelebihan kecepatan di atas ambang yang dihitung, supaya senggolan
  // pelan saat berebut posisi tidak diam-diam menggerus HP semua orang.
  const excess = impactSpeed - PHYSICS.ramMinSpeed;
  if (excess <= 0) return;

  const share = excess * PHYSICS.ramDamageFactor;
  // Bola yang lebih ringan menerima porsi damage lebih besar.
  const total = a.mass + b.mass;
  applyDamage(a, share * (b.mass / total) * 2, ctx, isEnemy(a, b) ? b : null, 'ram');
  applyDamage(b, share * (a.mass / total) * 2, ctx, isEnemy(a, b) ? a : null, 'ram');

  ctx.events.push({
    type: 'impact',
    x: (a.pos.x + b.pos.x) / 2,
    y: (a.pos.y + b.pos.y) / 2,
    strength: Math.min(1, excess / 400),
  });
}

/**
 * Petarung menghantam batu.
 *
 * Inilah yang membuat knockback punya konteks ruang: mendorong lawan ke tanah
 * lapang cuma memberi jarak, tapi mendorongnya ke batu memberi damage bonus.
 * Posisi jadi hal yang layak diperhitungkan, bukan sekadar latar.
 *
 * Damage ke petarung sengaja kecil (~5% kelebihan kecepatan). Ini bumbu, bukan
 * sumber kematian utama — kalau terlalu besar, pemenang ditentukan oleh letak
 * batu, bukan oleh build karakternya.
 */
export function applyRockImpact(fighter, obstacle, impactSpeed, ctx) {
  const excess = impactSpeed - OBSTACLE.impactMinSpeed;
  if (excess <= 0) return;

  applyDamage(fighter, excess * OBSTACLE.fighterDamageFactor, ctx, null, 'rock');

  const shattered = damageObstacle(obstacle, excess * OBSTACLE.rockDamageFactor);

  ctx.events.push({
    type: shattered ? 'rockShatter' : 'rockHit',
    x: obstacle.pos.x,
    y: obstacle.pos.y,
    radius: obstacle.radius,
    // Titik benturan, supaya percikannya keluar dari sisi yang benar.
    hitX: fighter.pos.x,
    hitY: fighter.pos.y,
    strength: Math.min(1, excess / 350),
  });

  if (shattered) ctx.log('Sebuah batu hancur berkeping.');
}
