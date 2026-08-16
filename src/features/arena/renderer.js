/**
 * Renderer arena (Canvas 2D).
 *
 * Batas tanggung jawab yang dijaga ketat:
 *   engine  -> menentukan APA yang terjadi (state + daftar event)
 *   renderer -> menentukan BAGAIMANA itu terlihat
 *
 * Renderer memegang state visualnya sendiri (partikel, angka damage, tracer)
 * yang tidak boleh memengaruhi hasil pertandingan. Karena itu simulasi tetap
 * deterministik meski efek visualnya memakai acak.
 */

import { ARENA, FighterState } from '../../engine/constants.js';

const TAU = Math.PI * 2;

/** Mengubah hex jadi "r, g, b" agar mudah dipakai dalam rgba(). */
function rgbTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export class ArenaRenderer {
  constructor() {
    this.texts = [];
    this.particles = [];
    this.tracers = [];
    this.waves = [];
    this.colorCache = new Map();
    this.shake = 0;
  }

  rgb(hex) {
    let value = this.colorCache.get(hex);
    if (!value) {
      value = rgbTriplet(hex);
      this.colorCache.set(hex, value);
    }
    return value;
  }

  reset() {
    this.texts.length = 0;
    this.particles.length = 0;
    this.tracers.length = 0;
    this.waves.length = 0;
    this.shake = 0;
  }

  _burst(x, y, count, color, speed, size = 2.4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 0.42 + Math.random() * 0.4,
        maxLife: 0.82,
        color,
        size: size * (0.6 + Math.random() * 0.8),
      });
    }
  }

  /** Menerjemahkan event engine jadi efek visual. */
  ingest(events) {
    for (const e of events) {
      switch (e.type) {
        case 'damage':
          this.texts.push({
            x: e.x,
            y: e.y,
            vy: -34,
            life: e.critical ? 1.1 : 0.8,
            maxLife: e.critical ? 1.1 : 0.8,
            text: e.critical ? `${e.amount}!` : `${e.amount}`,
            color: e.critical ? '#fde047' : '#ffffff',
            size: e.critical ? 19 : 14,
          });
          this._burst(e.x, e.y + 8, e.critical ? 12 : 6, e.color, 130);
          if (e.critical) this.shake = Math.min(9, this.shake + 4);
          break;

        case 'heal':
          this.texts.push({
            x: e.x,
            y: e.y,
            vy: -26,
            life: 0.8,
            maxLife: 0.8,
            text: `+${e.amount}`,
            color: '#86efac',
            size: 13,
          });
          break;

        case 'miss':
          this.texts.push({
            x: e.x,
            y: e.y,
            vy: -22,
            life: 0.6,
            maxLife: 0.6,
            text: 'miss',
            color: '#93a3bd',
            size: 12,
          });
          break;

        case 'shot':
          this.tracers.push({
            from: e.from,
            to: e.to,
            life: 0.18,
            maxLife: 0.18,
            color: e.color,
          });
          break;

        case 'swing':
          this.waves.push({
            x: e.to.x,
            y: e.to.y,
            r: 6,
            growth: 150,
            life: 0.2,
            maxLife: 0.2,
            color: e.color,
            width: 2,
          });
          break;

        case 'impact':
          this.waves.push({
            x: e.x,
            y: e.y,
            r: 4,
            growth: 220 * e.strength + 90,
            life: 0.3,
            maxLife: 0.3,
            color: '#ffffff',
            width: 2.5,
          });
          this.shake = Math.min(12, this.shake + e.strength * 7);
          break;

        case 'death':
          this._burst(e.x, e.y, 34, e.color, 260, 3.4);
          this.waves.push({
            x: e.x,
            y: e.y,
            r: e.radius,
            growth: 320,
            life: 0.55,
            maxLife: 0.55,
            color: e.color,
            width: 3,
          });
          this.shake = Math.min(14, this.shake + 8);
          break;

        case 'revive':
          this.waves.push({
            x: e.x,
            y: e.y,
            r: 8,
            growth: 300,
            life: 0.7,
            maxLife: 0.7,
            color: '#fde047',
            width: 3,
          });
          this.texts.push({
            x: e.x,
            y: e.y - 34,
            vy: -18,
            life: 1.3,
            maxLife: 1.3,
            text: 'SECOND WIND',
            color: '#fde047',
            size: 13,
          });
          break;

        case 'phase':
          this.waves.push({
            x: e.x,
            y: e.y,
            r: 6,
            growth: 220,
            life: 0.35,
            maxLife: 0.35,
            color: e.color,
            width: 2,
          });
          break;

        case 'ember':
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 30,
            vy: -30 - Math.random() * 40,
            life: 0.5,
            maxLife: 0.5,
            color: '#fb923c',
            size: 2.2,
          });
          break;

        case 'zoneBurn':
          this.particles.push({
            x: e.x + (Math.random() - 0.5) * 22,
            y: e.y + (Math.random() - 0.5) * 22,
            vx: 0,
            vy: -18,
            life: 0.6,
            maxLife: 0.6,
            color: '#c084fc',
            size: 2.6,
          });
          break;

        default:
          break;
      }
    }
  }

  /** Memajukan usia efek visual. Terpisah dari engine step. */
  update(dt) {
    const decay = (arr) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].life -= dt;
        if (arr[i].life <= 0) arr.splice(i, 1);
      }
    };

    for (const t of this.texts) t.y += t.vy * dt;

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 + 90 * dt;
    }

    for (const w of this.waves) w.r += w.growth * dt;

    decay(this.texts);
    decay(this.particles);
    decay(this.tracers);
    decay(this.waves);

    this.shake = Math.max(0, this.shake - dt * 34);
  }

  // ------------------------------------------------------------------ draw

  draw(ctx, sim) {
    const { width, height } = ARENA;

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    }

    this._drawBackground(ctx, width, height);
    this._drawZone(ctx, sim, width, height);
    this._drawTracers(ctx);

    for (const f of sim.list) {
      if (f.state === FighterState.DEAD) this._drawCorpse(ctx, f);
    }
    for (const f of sim.list) {
      if (f.state !== FighterState.DEAD) this._drawFighter(ctx, f, sim);
    }

    this._drawWaves(ctx);
    this._drawParticles(ctx);
    this._drawTexts(ctx);

    ctx.restore();
  }

  _drawBackground(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);

    const g = ctx.createRadialGradient(
      width / 2,
      height / 2,
      40,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    g.addColorStop(0, '#101833');
    g.addColorStop(1, '#05070f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 60; x < width; x += 60) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 60; y < height; y += 60) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  /**
   * Zona aman digambar sebagai "lubang" — area di luarnya diberi lapisan gelap
   * keunguan memakai fill rule evenodd. Ini jauh lebih murah daripada
   * clipping, dan langsung terbaca sebagai daerah berbahaya.
   */
  _drawZone(ctx, sim, width, height) {
    const zone = sim.zone;
    if (!zone || zone.radius >= Math.hypot(width, height) / 2 - 1) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(zone.x, zone.y, zone.radius, 0, TAU, true);
    ctx.fillStyle = 'rgba(126, 34, 206, 0.2)';
    ctx.fill('evenodd');
    ctx.restore();

    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -sim.time * 26;
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  _drawTracers(ctx) {
    for (const t of this.tracers) {
      const alpha = t.life / t.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${this.rgb(t.color)}, ${alpha * 0.85})`;
      ctx.lineWidth = 2 + alpha * 2;
      ctx.beginPath();
      ctx.moveTo(t.from.x, t.from.y);
      ctx.lineTo(t.to.x, t.to.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawCorpse(ctx, f) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = `rgb(${this.rgb(f.color)})`;
    ctx.beginPath();
    ctx.arc(f.pos.x, f.pos.y, f.radius * 0.7, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _drawFighter(ctx, f, sim) {
    const rgb = this.rgb(f.color);
    const { x, y } = f.pos;
    const r = f.radius;

    // --- jejak gerak ---
    if (f.trail.length > 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < f.trail.length; i++) {
        const t = i / f.trail.length;
        ctx.strokeStyle = `rgba(${rgb}, ${t * 0.16})`;
        ctx.lineWidth = r * 0.9 * t;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(f.trail[i - 1].x, f.trail[i - 1].y);
        ctx.lineTo(f.trail[i].x, f.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // --- aura luar ---
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.3);
    glow.addColorStop(0, `rgba(${rgb}, 0.34)`);
    glow.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.3, 0, TAU);
    ctx.fill();

    // --- badan bola ---
    const body = ctx.createRadialGradient(
      x - r * 0.35,
      y - r * 0.38,
      r * 0.12,
      x,
      y,
      r,
    );
    body.addColorStop(0, `rgba(255,255,255,0.92)`);
    body.addColorStop(0.35, `rgba(${rgb}, 0.95)`);
    body.addColorStop(1, `rgba(${rgb}, 0.55)`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();

    // Kilatan putih saat baru terkena serangan.
    if (f.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(f.hitFlash / 0.18) * 0.55})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }

    // Rim highlight — inti dari kesan "kaca".
    ctx.strokeStyle = `rgba(255,255,255,0.55)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r - 0.6, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();

    // --- indikator status ---
    if (f.state === FighterState.FLEEING) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(252, 211, 77, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    } else if (f.staggerTimer > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, TAU);
      ctx.stroke();
    }

    // --- cincin HP ---
    const ratio = Math.max(0, f.hp / f.maxHp);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle =
      ratio > 0.5 ? '#4ade80' : ratio > 0.22 ? '#facc15' : '#f87171';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * ratio);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // --- nama ---
    ctx.fillStyle = 'rgba(232, 237, 247, 0.9)';
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.name, x, y + r + 24);
  }

  _drawWaves(ctx) {
    for (const w of this.waves) {
      const alpha = w.life / w.maxLife;
      ctx.strokeStyle = `rgba(${this.rgb(w.color)}, ${alpha * 0.75})`;
      ctx.lineWidth = w.width * alpha;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, TAU);
      ctx.stroke();
    }
  }

  _drawParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = `rgba(${this.rgb(p.color)}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawTexts(ctx) {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const alpha = Math.min(1, t.life / (t.maxLife * 0.5));
      ctx.font = `700 ${t.size}px ui-sans-serif, system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.6})`;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = `rgba(${this.rgb(t.color)}, ${alpha})`;
      ctx.fillText(t.text, t.x, t.y);
    }
  }
}
