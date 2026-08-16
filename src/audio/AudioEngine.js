/**
 * Engine audio: bus, SFX, dan musik latar prosedural.
 *
 * Tiga hal yang membuat file ini lebih rumit dari sekadar "mainkan bunyi":
 *
 * 1. KEBIJAKAN AUTOPLAY. Browser menolak membuat suara sebelum ada interaksi
 *    pengguna. AudioContext karena itu dibuat MALAS — baru pada `unlock()`,
 *    yang dipanggil dari event klik pertama. Membuatnya lebih awal
 *    menghasilkan context ber-state "suspended" yang diam-diam tidak berbunyi.
 *
 * 2. PEMBATASAN LAJU. Di pertarungan enam bola, event `damage` bisa muncul
 *    belasan kali per detik. Memainkan semuanya menghasilkan dengung dan
 *    memaksa puluhan node hidup bersamaan. Tiap SFX punya jeda minimum
 *    sendiri.
 *
 * 3. HEADLESS. `npm run sim` dan test Node tidak punya AudioContext sama
 *    sekali. Semua jalur di sini harus aman saat Web Audio tidak ada, tanpa
 *    perlu penjagaan di sisi pemanggil.
 */

import { tone, noise, chord, semitone } from './synth.js';

const hasWebAudio =
  typeof window !== 'undefined' &&
  (window.AudioContext || window.webkitAudioContext);

/** Jeda minimum antar pemutaran, per jenis bunyi (detik). */
const THROTTLE = {
  swing: 0.05,
  hit: 0.035,
  crit: 0.08,
  fire: 0.05,
  miss: 0.1,
  rock: 0.07,
  impact: 0.09,
  death: 0.05,
  heal: 0.2,
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;

    this.settings = { master: 0.7, sfx: 0.9, music: 0.35, muted: false };
    this.lastPlayed = new Map();

    this.musicTimer = null;
    this.musicStep = 0;
    this.musicPlaying = false;
  }

  get available() {
    return Boolean(hasWebAudio);
  }

  /**
   * Membuat AudioContext. WAJIB dipanggil dari dalam handler event pengguna.
   * Aman dipanggil berkali-kali.
   */
  unlock() {
    if (!hasWebAudio) return false;

    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctor();

      this.master = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();

      // Kompresor di master mencegah tumpukan benturan menjadi kliping saat
      // enam bola bertabrakan bersamaan.
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;

      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(compressor).connect(this.ctx.destination);

      this._applyGains();
    }

    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setSettings(partial) {
    this.settings = { ...this.settings, ...partial };
    this._applyGains();
    if (this.settings.muted || this.settings.music <= 0) {
      // Musik dihentikan sungguhan, bukan cuma dikecilkan — penjadwal yang
      // terus berjalan di volume nol tetap membangunkan tab tiap beberapa
      // ratus milidetik tanpa alasan.
      if (this.musicPlaying) this.stopMusic();
    }
  }

  _applyGains() {
    if (!this.ctx) return;
    const m = this.settings.muted ? 0 : this.settings.master;
    this.master.gain.setTargetAtTime(m, this.ctx.currentTime, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx, this.ctx.currentTime, 0.02);
    this.musicBus.gain.setTargetAtTime(this.settings.music, this.ctx.currentTime, 0.02);
  }

  _canPlay(key) {
    if (!this.ctx || this.settings.muted || this.settings.sfx <= 0) return false;
    const now = this.ctx.currentTime;
    const gap = THROTTLE[key] ?? 0.04;
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < gap) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  // ------------------------------------------------------------------ SFX

  /**
   * @param {string} name
   * @param {Object} [opts] intensitas 0..1 untuk memodulasi bunyi
   */
  play(name, opts = {}) {
    if (!this.ctx) return;
    const bus = this.sfxBus;
    const ctx = this.ctx;
    const strength = Math.max(0, Math.min(1, opts.strength ?? 0.5));

    switch (name) {
      case 'swing':
        if (!this._canPlay('swing')) return;
        noise(ctx, bus, {
          duration: 0.11,
          gain: 0.16,
          filter: 'bandpass',
          freq: 1700,
          endFreq: 600,
          q: 1.2,
        });
        break;

      case 'hit':
        if (!this._canPlay('hit')) return;
        noise(ctx, bus, {
          duration: 0.09,
          gain: 0.2 + strength * 0.16,
          filter: 'lowpass',
          freq: 900,
          endFreq: 200,
        });
        tone(ctx, bus, {
          type: 'sine',
          freq: 150,
          endFreq: 62,
          duration: 0.1,
          gain: 0.24,
        });
        break;

      case 'crit':
        if (!this._canPlay('crit')) return;
        noise(ctx, bus, {
          duration: 0.14,
          gain: 0.3,
          filter: 'lowpass',
          freq: 2400,
          endFreq: 300,
        });
        tone(ctx, bus, { type: 'square', freq: 620, endFreq: 180, duration: 0.16, gain: 0.16 });
        tone(ctx, bus, { type: 'sine', freq: 110, endFreq: 50, duration: 0.2, gain: 0.3 });
        break;

      case 'fire':
        if (!this._canPlay('fire')) return;
        noise(ctx, bus, {
          duration: 0.08,
          gain: 0.13,
          filter: 'highpass',
          freq: 900,
          endFreq: 2600,
        });
        break;

      case 'cast':
        if (!this._canPlay('fire')) return;
        tone(ctx, bus, { type: 'triangle', freq: 380, endFreq: 900, duration: 0.16, gain: 0.12 });
        tone(ctx, bus, { type: 'sine', freq: 760, endFreq: 1800, duration: 0.16, gain: 0.07 });
        break;

      case 'miss':
        if (!this._canPlay('miss')) return;
        noise(ctx, bus, {
          duration: 0.16,
          gain: 0.1,
          filter: 'bandpass',
          freq: 2600,
          endFreq: 900,
          q: 3,
        });
        break;

      case 'rock':
        if (!this._canPlay('rock')) return;
        noise(ctx, bus, {
          duration: 0.13,
          gain: 0.16 + strength * 0.18,
          filter: 'lowpass',
          freq: 1500,
          endFreq: 260,
        });
        break;

      case 'shatter':
        noise(ctx, bus, { duration: 0.5, gain: 0.34, filter: 'highpass', freq: 400, endFreq: 2400 });
        noise(ctx, bus, { duration: 0.28, gain: 0.28, filter: 'lowpass', freq: 900, endFreq: 120 });
        break;

      case 'impact':
        if (!this._canPlay('impact')) return;
        tone(ctx, bus, { type: 'sine', freq: 190, endFreq: 60, duration: 0.14, gain: 0.22 });
        break;

      case 'death':
        if (!this._canPlay('death')) return;
        tone(ctx, bus, { type: 'sawtooth', freq: 320, endFreq: 60, duration: 0.5, gain: 0.2 });
        noise(ctx, bus, { duration: 0.35, gain: 0.2, filter: 'lowpass', freq: 1400, endFreq: 120 });
        break;

      case 'heal':
        if (!this._canPlay('heal')) return;
        tone(ctx, bus, { type: 'sine', freq: semitone(4), endFreq: semitone(11), duration: 0.26, gain: 0.09 });
        break;

      case 'revive':
        chord(ctx, bus, [semitone(-5), semitone(-1), semitone(2), semitone(7)], {
          duration: 0.7,
          gain: 0.13,
          stagger: 0.05,
        });
        break;

      case 'zone':
        tone(ctx, bus, { type: 'sawtooth', freq: 90, endFreq: 55, duration: 1.2, gain: 0.1 });
        break;

      case 'victory':
        chord(ctx, bus, [semitone(0), semitone(4), semitone(7), semitone(12)], {
          duration: 0.9,
          gain: 0.15,
          stagger: 0.09,
        });
        break;

      // --- UI ---
      case 'tick':
        if (!this._canPlay('tick')) return;
        noise(ctx, bus, { duration: 0.03, gain: 0.09, filter: 'bandpass', freq: 2800, q: 6 });
        break;

      case 'land':
        chord(ctx, bus, [semitone(7), semitone(12)], { duration: 0.45, gain: 0.13, stagger: 0.05 });
        break;

      case 'click':
        tone(ctx, bus, { type: 'square', freq: 520, duration: 0.05, gain: 0.06 });
        break;

      default:
        break;
    }
  }

  // ---------------------------------------------------------------- MUSIK

  /**
   * BGM prosedural: pad bass yang berjalan pelan plus arpeggio jarang.
   *
   * Sengaja tidak memakai loop sampel supaya tidak ada titik sambung yang
   * terdengar berulang. Penjadwalnya `setTimeout` dengan langkah 500 ms —
   * cukup presisi untuk musik ambient yang tidak punya beat tegas, dan jauh
   * lebih hemat daripada scheduler look-ahead yang sebenarnya tidak dibutuhkan
   * di sini.
   */
  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    if (this.settings.muted || this.settings.music <= 0) return;

    this.musicPlaying = true;
    this.musicStep = 0;

    const PROGRESSION = [-12, -12, -8, -8, -10, -10, -5, -5];
    const ARPEGGIO = [0, 3, 7, 10, 7, 3];

    const stepMs = 500;

    const tick = () => {
      if (!this.musicPlaying || !this.ctx) return;

      const step = this.musicStep++;
      const root = PROGRESSION[step % PROGRESSION.length];

      if (step % 2 === 0) {
        tone(this.ctx, this.musicBus, {
          type: 'sine',
          freq: semitone(root),
          duration: 1.6,
          gain: 0.16,
          attack: 0.35,
          release: 1.4,
        });
        tone(this.ctx, this.musicBus, {
          type: 'triangle',
          freq: semitone(root + 7),
          duration: 1.6,
          gain: 0.06,
          attack: 0.5,
          release: 1.3,
          detune: 6,
        });
      }

      // Arpeggio hanya sesekali — musik yang terlalu sibuk bersaing dengan
      // SFX pertarungan, dan justru membuat benturan terasa kurang berbobot.
      if (step % 4 === 2) {
        const note = ARPEGGIO[(step / 2) % ARPEGGIO.length | 0];
        tone(this.ctx, this.musicBus, {
          type: 'triangle',
          freq: semitone(root + 24 + note),
          duration: 0.5,
          gain: 0.05,
          attack: 0.02,
          release: 0.6,
        });
      }

      this.musicTimer = setTimeout(tick, stepMs);
    };

    tick();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

/**
 * Instance tunggal.
 *
 * Audio adalah sumber daya global perangkat keras — beberapa AudioContext di
 * satu halaman akan saling berebut dan Chrome membatasi jumlahnya. Jadi ini
 * salah satu kasus di mana singleton memang jawaban yang benar, bukan jalan
 * pintas.
 */
export const audioEngine = new AudioEngine();
