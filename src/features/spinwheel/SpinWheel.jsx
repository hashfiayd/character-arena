import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Roda putar.
 *
 * Catatan implementasi yang paling penting: hasil putaran DITENTUKAN DULU,
 * baru animasinya dihitung mundur agar berhenti di posisi itu.
 *
 * Kebalikannya (memutar dengan fisika lalu membaca di mana ia berhenti)
 * terdengar lebih "jujur", tapi bermasalah: hasilnya jadi bergantung pada
 * frame rate dan pembulatan float, sulit dibuat deterministik dari seed, dan
 * mustahil diuji. Semua roda putar di produksi bekerja seperti ini.
 *
 * Geometri: pointer ada di posisi jam 12. Di SVG sudut 0° menghadap jam 3,
 * jadi seluruh segmen digeser -90°. Segmen ke-i berpusat di
 * `(i + 0.5) * segmentAngle - 90`, sehingga rotasi yang membuatnya berhenti
 * tepat di bawah pointer adalah `-(i + 0.5) * segmentAngle`.
 */

const VIEWBOX = 220;
const CENTER = VIEWBOX / 2;
const RADIUS = 104;
const LABEL_RADIUS = 70;
/** Hub menutupi bagian tengah; label tidak boleh masuk ke sini. */
const HUB_RADIUS = 30;
const FULL_TURNS = 5;
const SPIN_SECONDS = 4.2;

/** Mencampur warna hex dengan hitam/putih. `amount` > 0 = lebih terang. */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (channel) =>
    Math.round(
      amount >= 0
        ? channel + (255 - channel) * amount
        : channel * (1 + amount),
    );
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r} ${g} ${b})`;
}

function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + Math.cos(rad) * radius,
    y: CENTER + Math.sin(rad) * radius,
  };
}

/**
 * Ukuran font label yang menyesuaikan panjang teks.
 *
 * Label ditulis sepanjang jari-jari, jadi ruangnya terbatas: dari tepi hub
 * sampai tepi roda. Dengan ukuran tetap, label panjang seperti "Blessing of
 * Dawn" akan menembus hub dan terlihat berantakan.
 */
function labelFontSize(label) {
  const available = (RADIUS - HUB_RADIUS - 8) * 2;
  const perChar = available / Math.max(label.length, 1);
  return Math.max(7.5, Math.min(11.5, perChar / 0.58));
}

function segmentPath(startDeg, endDeg) {
  const a = polar(startDeg, RADIUS);
  const b = polar(endDeg, RADIUS);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${b.x} ${b.y} Z`;
}

/**
 * @param {Object} props
 * @param {{ id: string, label: string, accent: string, options: Array }} props.slot
 * @param {() => number} props.pickIndex  mengembalikan index pemenang (dari RNG milik pemanggil)
 * @param {(option: Object, index: number) => void} props.onSettle
 * @param {boolean} [props.disabled]
 */
export function SpinWheel({ slot, pickIndex, onSettle, disabled }) {
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

  const segmentAngle = 360 / slot.options.length;

  const spin = useCallback(() => {
    if (spinning || disabled) return;

    const index = pickIndex();
    pendingIndex.current = index;
    setLanded(null);
    setSpinning(true);

    const target = -(index + 0.5) * segmentAngle;

    setRotation((current) => {
      // Selalu berputar maju: cari delta positif terkecil menuju sudut target,
      // lalu tambahkan beberapa putaran penuh agar terasa seperti dilempar.
      const delta = ((target - current) % 360 + 360) % 360;
      return current + FULL_TURNS * 360 + delta;
    });
  }, [disabled, pickIndex, segmentAngle, spinning]);

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
          {slot.options.map((option, i) => {
            const start = i * segmentAngle - 90;
            const end = start + segmentAngle;
            const mid = start + segmentAngle / 2;
            const labelPos = polar(mid, LABEL_RADIUS);
            // Balik teks di sisi kiri roda supaya tidak terbaca terbalik.
            const flip = mid > 90 || mid < -90;

            return (
              <g key={option.id}>
                <path
                  d={segmentPath(start, end)}
                  fill={shade(slot.accent, i % 2 === 0 ? -0.42 : -0.62)}
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="0.8"
                />
                <text
                  className="wheel__segment-label"
                  fontSize={labelFontSize(option.label)}
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${flip ? mid + 180 : mid} ${labelPos.x} ${labelPos.y})`}
                >
                  {option.label}
                </text>
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
            {landedOption ? landedOption.blurb : `${slot.options.length} pilihan`}
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
