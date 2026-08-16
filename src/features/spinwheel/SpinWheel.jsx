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
const LABEL_RADIUS = 70;
/** Hub menutupi bagian tengah; label tidak boleh masuk ke sini. */
const HUB_RADIUS = 30;
/** Di bawah lebar ini, label tidak muat dan malah jadi noise. */
const MIN_LABEL_SWEEP = 13;
const FULL_TURNS = 5;
const SPIN_SECONDS = 4.2;

/** Mencampur warna hex dengan hitam/putih. `amount` > 0 = lebih terang. */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (channel) =>
    Math.round(
      amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount),
    );
  return `rgb(${mix((n >> 16) & 255)} ${mix((n >> 8) & 255)} ${mix(n & 255)})`;
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
  const radialRoom = (RADIUS - HUB_RADIUS - 8) * 2;
  const byLength = radialRoom / Math.max(label.length, 1) / 0.58;
  const tangentialRoom = (sweepDeg / 360) * 2 * Math.PI * LABEL_RADIUS;
  return Math.max(7, Math.min(11.5, byLength, tangentialRoom * 0.7));
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
export function SpinWheel({ slot, weights, pickIndex, onSettle, disabled }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(null);
  const pendingIndex = useRef(null);
  const discRef = useRef(null);

  // Reset saat slot berganti, kalau tidak roda "meneruskan" sudut slot lama.
  useEffect(() => {
    setRotation(0);
    setSpinning(false);
    setLanded(null);
    pendingIndex.current = null;
  }, [slot.id]);

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

    const target = -90 - segments[index].mid;

    setRotation((current) => {
      // Selalu berputar maju: cari delta positif terkecil menuju sudut target,
      // lalu tambahkan beberapa putaran penuh agar terasa seperti dilempar.
      const delta = (((target - current) % 360) + 360) % 360;
      return current + FULL_TURNS * 360 + delta;
    });
  }, [disabled, pickIndex, segments, spinning]);

  const handleTransitionEnd = useCallback(
    (event) => {
      if (event.target !== discRef.current || pendingIndex.current === null) return;
      const index = pendingIndex.current;
      pendingIndex.current = null;
      setSpinning(false);
      setLanded(index);
      onSettle?.(slot.options[index], index);
    },
    [onSettle, slot.options],
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
            const labelPos = polar(mid, LABEL_RADIUS);
            // Balik teks di sisi kiri roda supaya tidak terbaca terbalik.
            const flip = mid > 90 || mid < -90;
            const showLabel = sweep >= MIN_LABEL_SWEEP;

            return (
              <g key={option.id}>
                <path
                  d={segmentPath(start, sweep)}
                  fill={shade(slot.accent, index % 2 === 0 ? -0.42 : -0.62)}
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="0.8"
                />
                {showLabel && (
                  <text
                    className="wheel__segment-label"
                    fontSize={labelFontSize(option.label, sweep)}
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${flip ? mid + 180 : mid} ${labelPos.x} ${labelPos.y})`}
                  >
                    {option.label}
                  </text>
                )}
              </g>
            );
          })}

          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="1.5"
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
