import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { weightsToProbabilities } from '../../domain/weights.js';

/**
 * Roda putar dengan potongan proporsional terhadap peluang.
 *
 * Dua keputusan implementasi yang penting:
 *
 * 1. Hasil DITENTUKAN DULU, animasinya dihitung mundur agar berhenti di sana.
 *    Kebalikannya (memutar dengan fisika lalu membaca posisi berhenti)
 *    terdengar lebih jujur, tapi hasilnya jadi bergantung frame rate dan
 *    pembulatan float, tidak deterministik dari seed, dan mustahil diuji.
 *
 * 2. Lebar potongan = bobot sebenarnya, bukan dibagi rata. Bobot yang sama
 *    persis dipakai untuk menggambar DAN untuk mengundi (dilewatkan dari
 *    pemanggil lewat prop `weights`), jadi tidak ada celah keduanya berbeda.
 *    Roda yang potongannya seragam tapi diam-diam berbobot timpang itu
 *    menipu pemain — dan bikin balancing mustahil dijelaskan.
 *
 * Geometri: pointer di posisi jam 12. Di SVG sudut 0 derajat menghadap jam 3,
 * jadi semua sudut digeser -90. Untuk menghentikan segmen ke-i tepat di bawah
 * pointer, rotasi yang dibutuhkan adalah `-90 - midAngle_i`.
 */

const VIEWBOX = 220;
const CENTER = VIEWBOX / 2;
const RADIUS = 104;
/**
 * Jangkar dalam untuk label. Harus di LUAR hub.
 *
 * Hub adalah elemen HTML terpisah yang menimpa SVG (inset 33% dari lebar
 * wadah), jadi radiusnya dalam satuan SVG sekitar 37. Angka 46 menyisakan
 * ruang aman — pada 40, label panjang seperti "Juggernaut" ujungnya tertimpa
 * hub dan huruf terakhirnya hilang.
 */
const LABEL_INNER = 46;
/** Hub menutupi bagian tengah; label tidak boleh masuk ke sini. */
const HUB_RADIUS = 30;
/** Di bawah lebar ini, label tidak muat dan malah jadi noise. */
const MIN_LABEL_SWEEP = 13;
const FULL_TURNS = 5;
const SPIN_SECONDS = 4.2;

/** Hue dasar (0-360) dari warna aksen slot. */
function hueOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/**
 * Warna potongan: hue berputar sepanjang lingkaran, mengelilingi hue slot.
 *
 * Roda satu warna dengan dua tingkat kecerahan (versi sebelumnya) membuat
 * potongan bersebelahan sulit dibedakan begitu rodanya berputar cepat —
 * matanya kehilangan jejak. Rentang hue memberi tiap potongan identitas
 * sendiri, sambil tetap terbaca sebagai satu keluarga karena berpusat di hue
 * slot yang bersangkutan.
 */
function segmentFill(accent, index, total) {
  const base = hueOf(accent);
  const spread = 150;
  const t = total > 1 ? index / (total - 1) : 0.5;
  const hue = (base + (t - 0.5) * spread + 360) % 360;
  const light = 34 + (index % 2) * 8;
  return `hsl(${hue.toFixed(1)} 62% ${light}%)`;
}

function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + Math.cos(rad) * radius,
    y: CENTER + Math.sin(rad) * radius,
  };
}

/**
 * Ukuran font label menyesuaikan panjang teks DAN lebar potongan.
 * Label ditulis sepanjang jari-jari, jadi ruangnya dibatasi dua arah:
 * radial (tepi hub ke tepi roda) dan tangensial (lebar potongan).
 */
function labelFontSize(label, sweepDeg) {
  const radialRoom = RADIUS - LABEL_INNER - 6;
  const byLength = radialRoom / Math.max(label.length, 1) / 0.55;
  // Lebar tangensial diukur di tengah panjang teks, bukan di tepi roda.
  const tangentialRoom = (sweepDeg / 360) * 2 * Math.PI * (LABEL_INNER + radialRoom / 2);
  return Math.max(6.5, Math.min(12, byLength, tangentialRoom * 0.78));
}

function segmentPath(startDeg, sweepDeg) {
  // Potongan penuh tidak bisa digambar dengan satu arc (titik awal = titik
  // akhir, browser menggambar nol). Kasus ini muncul kalau sebuah slot hanya
  // punya satu opsi yang mungkin.
  if (sweepDeg >= 359.9) {
    return `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - RADIUS} Z`;
  }
  const a = polar(startDeg, RADIUS);
  const b = polar(startDeg + sweepDeg, RADIUS);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${b.x} ${b.y} Z`;
}

/**
 * @param {Object} props
 * @param {{ id: string, label: string, hint: string, accent: string, options: Array }} props.slot
 * @param {number[]} props.weights bobot per opsi — WAJIB sama dengan yang dipakai mengundi
 * @param {() => number} props.pickIndex mengembalikan index pemenang
 * @param {(option: Object, index: number) => void} props.onSettle
 * @param {boolean} [props.disabled]
 */
export function SpinWheel({ slot, weights, pickIndex, onSettle, disabled, audio }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(null);
  const pendingIndex = useRef(null);
  const discRef = useRef(null);
  const tickTimer = useRef(null);

  // Reset saat slot berganti, kalau tidak roda "meneruskan" sudut slot lama.
  useEffect(() => {
    setRotation(0);
    setSpinning(false);
    setLanded(null);
    pendingIndex.current = null;
    clearTimeout(tickTimer.current);
  }, [slot.id]);

  useEffect(() => () => clearTimeout(tickTimer.current), []);

  /**
   * Bunyi "tik" mengikuti perlambatan roda.
   *
   * Jadwalnya dihitung dari kurva `1 - (1-u)^3`, yang mendekati easing
   * cubic-bezier pada animasi CSS-nya. Menjadwalkan tik dengan jarak seragam
   * akan terdengar salah justru karena rodanya terlihat melambat — telinga
   * langsung menangkap ketidakcocokan itu meski matanya tidak.
   */
  const scheduleTicks = useCallback(() => {
    if (!audio) return;
    const TOTAL = 34;
    const durationMs = SPIN_SECONDS * 1000;
    const timeAt = (i) => durationMs * (1 - Math.pow(1 - i / TOTAL, 3));

    let i = 0;
    const next = () => {
      if (i >= TOTAL) return;
      audio.play('tick');
      const current = timeAt(i);
      i += 1;
      const delay = Math.max(16, timeAt(i) - current);
      tickTimer.current = setTimeout(next, delay);
    };
    next();
  }, [audio]);

  const segments = useMemo(() => {
    const total = weights.reduce((sum, w) => sum + w, 0) || 1;
    let cursor = -90;
    return slot.options.map((option, i) => {
      const sweep = (weights[i] / total) * 360;
      const seg = { option, index: i, start: cursor, sweep, mid: cursor + sweep / 2 };
      cursor += sweep;
      return seg;
    });
  }, [slot.options, weights]);

  const probabilities = useMemo(() => weightsToProbabilities(weights), [weights]);

  const spin = useCallback(() => {
    if (spinning || disabled) return;

    const index = pickIndex();
    pendingIndex.current = index;
    setLanded(null);
    setSpinning(true);
    scheduleTicks();

    const target = -90 - segments[index].mid;

    setRotation((current) => {
      // Selalu berputar maju: cari delta positif terkecil menuju sudut target,
      // lalu tambahkan beberapa putaran penuh agar terasa seperti dilempar.
      const delta = (((target - current) % 360) + 360) % 360;
      return current + FULL_TURNS * 360 + delta;
    });
  }, [disabled, pickIndex, scheduleTicks, segments, spinning]);

  const handleTransitionEnd = useCallback(
    (event) => {
      if (event.target !== discRef.current || pendingIndex.current === null) return;
      const index = pendingIndex.current;
      pendingIndex.current = null;
      clearTimeout(tickTimer.current);
      setSpinning(false);
      setLanded(index);
      audio?.play('land');
      onSettle?.(slot.options[index], index);
    },
    [audio, onSettle, slot.options],
  );

  const landedOption = landed !== null ? slot.options[landed] : null;

  return (
    <div className="wheel-stage" style={{ '--slot-accent': slot.accent }}>
      <div className="wheel-stage__slot">
        <div className="wheel-stage__label">{slot.label}</div>
        <p className="wheel-stage__hint">{slot.hint}</p>
      </div>

      <div className="wheel">
        <div className="wheel__pointer" />

        <svg
          ref={discRef}
          className={`wheel__disc ${spinning ? 'wheel__disc--spinning' : ''}`}
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          style={{
            transform: `rotate(${rotation}deg)`,
            '--spin-duration': `${SPIN_SECONDS}s`,
          }}
          onTransitionEnd={handleTransitionEnd}
          role="img"
          aria-label={`Roda ${slot.label}`}
        >
          {segments.map(({ option, index, start, sweep, mid }) => {
            // Label membaca dari pusat ke tepi, seperti roda undian sungguhan.
            //
            // Di separuh kiri teksnya akan terbalik, jadi seluruh teks diputar
            // 180 derajat. Setelah diputar, sumbu +X lokal menghadap KE DALAM,
            // sehingga jangkarnya harus dipindah ke tepi luar agar teks tumbuh
            // menuju pusat. Anchor tetap 'start' di kedua kasus — memakai
            // 'end' membuat teks tumbuh ke arah yang salah dan meluber keluar
            // roda, yang persis terjadi pada percobaan pertama.
            const flip = mid > 90 || mid < -90;
            const anchorR = flip ? RADIUS - 8 : LABEL_INNER;
            const labelPos = polar(mid, anchorR);
            const showLabel = sweep >= MIN_LABEL_SWEEP;

            return (
              <g key={option.id}>
                <path
                  d={segmentPath(start, sweep)}
                  fill={segmentFill(slot.accent, index, segments.length)}
                  stroke="rgba(8,12,22,0.55)"
                  strokeWidth="0.9"
                />
                {showLabel && (
                  <text
                    className="wheel__segment-label"
                    fontSize={labelFontSize(option.label, sweep)}
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="start"
                    dominantBaseline="middle"
                    transform={`rotate(${flip ? mid + 180 : mid} ${labelPos.x} ${labelPos.y})`}
                  >
                    {option.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Bingkai gelap tebal, seperti pelek roda undian. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS + 3.5}
            fill="none"
            stroke="rgba(10,14,26,0.92)"
            strokeWidth="7"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS + 6.5}
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.2"
          />
        </svg>

        <div className="wheel__hub">
          <div className="wheel__hub-value">
            {landedOption ? landedOption.label : spinning ? '…' : 'Siap'}
          </div>
          <div className="wheel__hub-caption">
            {landedOption
              ? `peluang ${(probabilities[landed] * 100).toFixed(1)}%`
              : `${slot.options.length} pilihan`}
          </div>
        </div>
      </div>

      <button
        className="btn btn--primary"
        style={{ '--btn-accent': slot.accent, minWidth: 180 }}
        onClick={spin}
        disabled={spinning || disabled}
      >
        {spinning ? 'Memutar…' : `Putar ${slot.label}`}
      </button>
    </div>
  );
}
