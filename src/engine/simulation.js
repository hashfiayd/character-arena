/**
 * Orkestrator pertandingan.
 *
 * PENTING: kelas ini tidak menyentuh DOM, React, maupun canvas sama sekali.
 * Itu disengaja — konsekuensinya kamu bisa menjalankan 10.000 pertandingan
 * headless di Node untuk mengecek balance (lihat scripts/headless-sim.mjs),
 * dan kamu bisa unit-test hasilnya tanpa jsdom.
 *
 * Urutan satu step tidak boleh diubah sembarangan:
 *   1. timer          — cooldown & stagger berkurang lebih dulu
 *   2. steering       — AI memutuskan gaya berdasarkan state saat ini
 *   3. integrate      — posisi & kecepatan diperbarui
 *   4. dinding        — koreksi batas arena
 *   5. tumbukan       — resolusi overlap antar bola
 *   6. serangan       — dilakukan SETELAH posisi final, supaya cek jangkauan
 *                       memakai posisi yang benar-benar dirender
 *   7. aura & regen   — efek berkelanjutan
 *   8. cek akhir      — kondisi menang
 */

import { ARENA, BattleMode, SIM, ZONE, FighterState } from './constants.js';
import { createFighter, isAlive } from './fighter.js';
import { computeSteering } from './steering.js';
import {
  integrate,
  resolveWalls,
  resolveCollisions,
  spawnPositions,
} from './physics.js';
import {
  updateTimers,
  applyRegen,
  applyBurnAuras,
  applyDamage,
  applyRamDamage,
  tryAttack,
} from './combat.js';
import { hydrateCharacter, TEAM_COLORS } from '../domain/character.js';
import { createRng, hashSeed } from '../lib/rng.js';

const MAX_LOG = 60;

export class BattleSimulation {
  /**
   * @param {Object} config
   * @param {import('../domain/character.js').Character[]} config.characters
   * @param {string} config.mode        BattleMode
   * @param {number[]} [config.teams]   teamId per karakter (khusus mode TEAM)
   * @param {string|number} [config.seed]
   */
  constructor({ characters, mode = BattleMode.FFA, teams = null, seed }) {
    if (!characters?.length || characters.length < 2) {
      throw new Error('Butuh minimal 2 karakter untuk bertanding.');
    }
    if (mode === BattleMode.DUEL && characters.length !== 2) {
      throw new Error('Mode Duel harus tepat 2 karakter.');
    }

    this.mode = mode;
    this.seedValue = typeof seed === 'string' ? hashSeed(seed) : (seed ?? Date.now());
    this.seedLabel = typeof seed === 'string' ? seed : String(this.seedValue);
    this.rng = createRng(this.seedValue);

    this.time = 0;
    this.events = [];
    this.log = [];
    this.result = null;

    const spawns = spawnPositions(characters.length, this.rng);

    /** @type {Map<string, ReturnType<typeof createFighter>>} */
    this.fighters = new Map();

    characters.forEach((character, index) => {
      const hydrated = hydrateCharacter(character);
      const teamId =
        mode === BattleMode.TEAM ? (teams?.[index] ?? index % 2) : index;

      const fighter = createFighter(hydrated, {
        ...spawns[index],
        teamId,
        // Di mode tim, warna bola mengikuti warna tim supaya keberpihakan
        // langsung terbaca; di mode lain pakai warna pribadi karakter.
        color:
          mode === BattleMode.TEAM
            ? TEAM_COLORS[teamId % TEAM_COLORS.length]
            : hydrated.color,
        orbitDir: this.rng.chance(0.5) ? 1 : -1,
        wanderAngle: this.rng.angle(),
      });

      this.fighters.set(fighter.id, fighter);
    });

    /** Array datar — dipakai di loop panas supaya tidak bikin iterator Map. */
    this.list = [...this.fighters.values()];

    // Pusat zona digeser sedikit dan acak per-seed, supaya posisi spawn tidak
    // selalu memberi keuntungan yang sama ke slot yang sama.
    this.zoneCenter = {
      x: ARENA.width / 2 + (this.rng.next() - 0.5) * ARENA.width * 0.16,
      y: ARENA.height / 2 + (this.rng.next() - 0.5) * ARENA.height * 0.16,
    };
    this.zoneStartRadius = Math.hypot(ARENA.width, ARENA.height) / 2;
    this.zone = { ...this.zoneCenter, radius: this.zoneStartRadius };

    this.ctx = {
      rng: this.rng,
      events: this.events,
      time: 0,
      log: (text) => this._pushLog(text),
    };

    this._pushLog(`Pertandingan dimulai — seed ${this.seedLabel}`);
  }

  _pushLog(text) {
    this.log.push({ time: this.time, text });
    if (this.log.length > MAX_LOG) this.log.shift();
  }

  /** Ambil dan kosongkan buffer event visual. */
  drainEvents() {
    if (!this.events.length) return [];
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  get alive() {
    return this.list.filter(isAlive);
  }

  get isOver() {
    return this.result !== null;
  }

  /** @param {number} dt detik (harus tetap — lihat SIM.dt) */
  step(dt) {
    if (this.result) return;

    this.time += dt;
    this.ctx.time = this.time;
    this._updateZone();

    for (const f of this.list) {
      if (!isAlive(f)) continue;
      updateTimers(f, dt);
    }

    // Cache target hasil steering supaya tidak perlu dicari ulang saat menyerang.
    const targets = new Map();
    for (const f of this.list) {
      if (!isAlive(f)) continue;
      const target = computeSteering(f, this.fighters, this.rng, dt, this.zone);
      if (target) targets.set(f.id, target);
    }

    for (const f of this.list) integrate(f, dt);
    for (const f of this.list) resolveWalls(f);

    resolveCollisions(this.list, (a, b, impactSpeed) =>
      applyRamDamage(a, b, impactSpeed, this.ctx),
    );

    for (const f of this.list) {
      if (!isAlive(f) || f.staggerTimer > 0) continue;
      const target = targets.get(f.id);
      if (target && isAlive(target)) tryAttack(f, target, this.ctx);
    }

    applyBurnAuras(this.list, this.ctx, dt);
    for (const f of this.list) applyRegen(f, dt);

    this._applyZoneDamage(dt);
    this._applySuddenDeath(dt);
    this._checkVictory();
  }

  /** Radius zona menyusut linear setelah `ZONE.startTime`. */
  _updateZone() {
    const elapsed = this.time - ZONE.startTime;
    if (elapsed <= 0) {
      this.zone.radius = this.zoneStartRadius;
      return;
    }

    if (!this._zoneAnnounced) {
      this._zoneAnnounced = true;
      this._pushLog('Zona aman mulai menyusut.');
    }

    const t = Math.min(1, elapsed / ZONE.shrinkDuration);
    this.zone.radius =
      this.zoneStartRadius + (ZONE.finalRadius - this.zoneStartRadius) * t;
  }

  _applyZoneDamage(dt) {
    if (this.time < ZONE.startTime) return;
    const dps = ZONE.dps + (this.time - ZONE.startTime) * ZONE.dpsRamp;

    for (const f of this.list) {
      if (!isAlive(f)) continue;
      const d = Math.hypot(f.pos.x - this.zone.x, f.pos.y - this.zone.y);
      if (d <= this.zone.radius) continue;

      applyDamage(f, dps * dt, this.ctx, null, 'zone');
      if (this.rng.chance(dt * 5)) {
        this.events.push({ type: 'zoneBurn', x: f.pos.x, y: f.pos.y });
      }
    }
  }

  /**
   * Anti-stalemate.
   *
   * Dua Cleric ber-regen tinggi dengan senjata lemah bisa bertarung selamanya.
   * Setelah `softTimeLimit`, arena mulai menggerus semua orang; laju gerusannya
   * naik seiring waktu sehingga pertandingan DIJAMIN selesai.
   */
  _applySuddenDeath(dt) {
    if (this.time < SIM.softTimeLimit) return;

    if (!this._suddenDeathAnnounced) {
      this._suddenDeathAnnounced = true;
      this._pushLog('Sudden death! Arena mulai menggerus semua petarung.');
      this.events.push({ type: 'suddenDeath' });
    }

    const overtime = this.time - SIM.softTimeLimit;
    const scale = 1 + overtime / 12;
    for (const f of this.list) {
      if (!isAlive(f)) continue;
      applyDamage(f, SIM.suddenDeathDps * scale * dt, this.ctx, null, 'arena');
    }
  }

  _checkVictory() {
    const alive = this.alive;
    const teams = new Set(alive.map((f) => f.teamId));

    if (teams.size > 1 && this.time < SIM.hardTimeLimit) return;

    let winners = alive;
    let reason = 'elimination';

    if (teams.size > 1) {
      // Batas keras tercapai: pemenang ditentukan sisa HP relatif.
      reason = 'timeout';
      const byTeam = new Map();
      for (const f of alive) {
        byTeam.set(f.teamId, (byTeam.get(f.teamId) ?? 0) + f.hp / f.maxHp);
      }
      const bestTeam = [...byTeam.entries()].sort((a, b) => b[1] - a[1])[0][0];
      winners = alive.filter((f) => f.teamId === bestTeam);
    } else if (teams.size === 0) {
      reason = 'draw';
    }

    this.result = {
      reason,
      winnerTeam: winners[0]?.teamId ?? null,
      winnerIds: winners.map((f) => f.id),
      winnerNames: winners.map((f) => f.name),
      duration: this.time,
      scoreboard: this.list
        .map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          teamId: f.teamId,
          kills: f.kills,
          damageDealt: Math.round(f.damageDealt),
          damageTaken: Math.round(f.damageTaken),
          healed: Math.round(f.healed),
          survived: isAlive(f),
          hp: Math.round(f.hp),
          maxHp: Math.round(f.maxHp),
        }))
        .sort((a, b) => Number(b.survived) - Number(a.survived) || b.kills - a.kills || b.damageDealt - a.damageDealt),
    };

    this._pushLog(
      reason === 'draw'
        ? 'Seri — tidak ada yang tersisa.'
        : `Pemenang: ${this.result.winnerNames.join(', ')}`,
    );
    this.events.push({ type: 'victory' });
  }

  /** Menjalankan sampai selesai tanpa render — untuk test & analisis balance. */
  runToCompletion(maxSeconds = SIM.hardTimeLimit + 5) {
    const steps = Math.ceil(maxSeconds / SIM.dt);
    for (let i = 0; i < steps && !this.result; i++) {
      this.step(SIM.dt);
      this.events.length = 0; // headless: buang event visual
    }
    return this.result;
  }
}

export { BattleMode, FighterState };
