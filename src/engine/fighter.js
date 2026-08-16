/**
 * Fighter = representasi RUNTIME dari sebuah Character di dalam arena.
 *
 * Pemisahan Character vs Fighter itu disengaja:
 *   Character = data persisten, immutable, disimpan di storage.
 *   Fighter   = state yang berubah 60x per detik (posisi, HP, cooldown).
 *
 * Kalau keduanya digabung, kamu akan tanpa sadar menyimpan `vel` dan `hp`
 * ke localStorage, dan roster jadi kotor.
 */

import { FighterState } from './constants.js';
import { preferredDistance, isRanged } from '../domain/stats.js';
import { EFFECT_IDS } from '../data/pools.js';

/**
 * @param {ReturnType<import('../domain/character.js').hydrateCharacter>} hydrated
 * @param {{ teamId: number, x: number, y: number, color?: string }} placement
 */
export function createFighter(hydrated, placement) {
  const stats = hydrated.stats;

  return {
    id: hydrated.id,
    name: hydrated.name,
    color: placement.color ?? hydrated.color,
    teamId: placement.teamId,

    stats,
    effects: hydrated.effects,
    radius: hydrated.radius,
    mass: stats.mass,
    ranged: isRanged(stats),
    preferredDist: preferredDistance(stats),

    pos: { x: placement.x, y: placement.y },
    vel: { x: 0, y: 0 },
    /** Gaya yang dikumpulkan steering di frame ini, di-reset tiap step. */
    force: { x: 0, y: 0 },

    hp: stats.maxHp,
    maxHp: stats.maxHp,
    state: FighterState.ACTIVE,

    attackCooldown: 0,
    staggerTimer: 0,
    invulnTimer: 0,
    /** Timer visual: berapa lama lagi bola berkedip putih setelah kena. */
    hitFlash: 0,
    /** Timer visual: kilatan saat melancarkan serangan. */
    swingFlash: 0,

    targetId: null,
    targetTimer: 0,
    wanderAngle: placement.wanderAngle ?? 0,
    /**
     * Arah orbit (+1 / -1) dibuat tetap seumur pertandingan. Kalau arahnya
     * diacak tiap frame, gerakannya terlihat gemetar, bukan mengitari.
     */
    orbitDir: placement.orbitDir ?? 1,

    secondWindUsed: !hydrated.effects.has(EFFECT_IDS.SECOND_WIND),

    // Statistik pertandingan
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    healed: 0,
    diedAt: null,

    /** Jejak posisi untuk motion trail di renderer. */
    trail: [],
  };
}

export const isAlive = (f) => f.state !== FighterState.DEAD;

/** Fighter yang staggered kehilangan kendali — inilah yang bikin knockback terasa. */
export const canSteer = (f) => isAlive(f) && f.staggerTimer <= 0;

export const hpRatio = (f) => f.hp / f.maxHp;

/**
 * Sekutu = teamId sama. Di mode FFA setiap fighter diberi teamId unik,
 * jadi fungsi ini bekerja untuk ketiga mode tanpa percabangan tambahan.
 */
export const isEnemy = (a, b) => a.teamId !== b.teamId;
