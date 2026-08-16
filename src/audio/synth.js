/**
 * Primitif sintesis suara di atas Web Audio API.
 *
 * Tidak ada satu pun file audio di project ini. Semua bunyi dibangkitkan dari
 * osilator dan noise. Konsekuensinya jujur perlu disebut:
 *
 *   + Ukuran project tetap kecil, tidak ada urusan lisensi aset, dan tiap
 *     bunyi bisa disetel lewat angka seperti halnya balance.
 *   - Karakternya retro/sintetik. Ini tidak akan terdengar seperti rekaman
 *     pedang sungguhan, dan tidak ada trik parameter yang bisa mengubah itu.
 *
 * Semua fungsi di sini menjadwalkan bunyi lalu langsung selesai — node-nya
 * membersihkan diri sendiri lewat `stop()`. Tidak ada state yang disimpan,
 * jadi tidak ada kebocoran node meski ratusan bunyi dipicu per pertandingan.
 */

/**
 * Buffer noise putih, dibuat SEKALI lalu dipakai ulang.
 *
 * Membuat buffer 1 detik untuk tiap benturan berarti mengalokasikan 44.100
 * float setiap kali pedang mengenai — di pertarungan ramai itu puluhan kali
 * per detik, dan GC-nya terdengar sebagai patahan audio.
 */
let noiseBuffer = null;

function getNoiseBuffer(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;

  const length = Math.floor(ctx.sampleRate * 1.0);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  noiseBuffer = buffer;
  return buffer;
}

/**
 * Nada berosilator dengan amplop ADSR sederhana.
 *
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {Object} opts
 */
export function tone(ctx, destination, opts) {
  const {
    type = 'sine',
    freq = 440,
    endFreq = null,
    duration = 0.2,
    gain = 0.3,
    attack = 0.005,
    release = null,
    detune = 0,
    when = 0,
  } = opts;

  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== null) {
    // Ramp eksponensial terdengar jauh lebih alami untuk pitch daripada linear,
    // karena persepsi tinggi nada memang logaritmik. Nilai tidak boleh nol.
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration);
  }

  const rel = release ?? duration;
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0001), t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + rel);

  osc.connect(amp).connect(destination);
  osc.start(t0);
  osc.stop(t0 + attack + rel + 0.02);
}

/** Semburan noise yang difilter — dasar untuk benturan, ayunan, dan ledakan. */
export function noise(ctx, destination, opts) {
  const {
    duration = 0.15,
    gain = 0.3,
    filter = 'lowpass',
    freq = 1200,
    endFreq = null,
    q = 1,
    when = 0,
    playbackRate = 1,
  } = opts;

  const t0 = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.playbackRate.value = playbackRate;
  // Offset acak supaya dua benturan beruntun tidak terdengar identik.
  const offset = Math.random() * 0.5;

  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, t0);
  biquad.Q.value = q;
  if (endFreq !== null) {
    biquad.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t0 + duration);
  }

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(Math.max(gain, 0.0001), t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  src.connect(biquad).connect(amp).connect(destination);
  src.start(t0, offset, duration + 0.05);
  src.stop(t0 + duration + 0.05);
}

/** Beberapa nada sekaligus — dipakai untuk akor kemenangan. */
export function chord(ctx, destination, freqs, opts = {}) {
  const { stagger = 0.06, when = 0, ...rest } = opts;
  freqs.forEach((freq, i) => {
    tone(ctx, destination, {
      type: 'triangle',
      duration: 0.5,
      gain: 0.16,
      ...rest,
      freq,
      when: when + stagger * i,
    });
  });
}

/** Frekuensi nada dari nomor semitone relatif terhadap A4 = 440 Hz. */
export const semitone = (n) => 440 * Math.pow(2, n / 12);
