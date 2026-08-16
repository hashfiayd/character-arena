import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SLOTS } from '../../data/pools.js';
import { computeStats, powerScore, radiusFromMass } from '../../domain/stats.js';
import { createCharacter, generateName, spinSlot } from '../../domain/character.js';
import { resolveWeights, pickIndexByWeights } from '../../domain/weights.js';
import { createRng } from '../../lib/rng.js';
import { Button, GlassPanel, StatBar } from '../../ui/primitives.jsx';
import { SpinWheel } from './SpinWheel.jsx';

/**
 * Batas atas bar statistik.
 *
 * Sengaja berupa konstanta, bukan nilai maksimum dari roster saat ini.
 * Kalau skalanya ikut berubah mengikuti data, panjang bar kehilangan makna
 * absolut dan dua karakter tidak bisa dibandingkan secara adil.
 */
const STAT_VIEW = [
  { key: 'maxHp', label: 'HP', max: 400, color: '#4ade80' },
  { key: 'atk', label: 'Serangan', max: 90, color: '#f87171' },
  { key: 'def', label: 'Pertahanan', max: 60, color: '#fcd34d' },
  { key: 'spd', label: 'Kecepatan', max: 300, color: '#38bdf8' },
  { key: 'attackSpeed', label: 'Tempo', max: 3, color: '#c084fc', format: (v) => `${v.toFixed(2)}x` },
  { key: 'range', label: 'Jangkauan', max: 260, color: '#f0abfc' },
  { key: 'mass', label: 'Massa', max: 4.5, color: '#94a3b8', format: (v) => v.toFixed(2) },
  { key: 'crit', label: 'Kritikal', max: 0.85, color: '#fb923c', format: (v) => `${Math.round(v * 100)}%` },
  { key: 'evasion', label: 'Hindar', max: 0.45, color: '#2dd4bf', format: (v) => `${Math.round(v * 100)}%` },
  { key: 'regen', label: 'Regen', max: 12, color: '#86efac', format: (v) => `${v.toFixed(1)}/s` },
];

export function CharacterForge({ onSave, audio }) {
  // Satu RNG untuk seluruh sesi forge — bukan Math.random per-putaran — supaya
  // urutan hasilnya bisa direproduksi kalau nanti kamu mau menambah fitur
  // "share seed karakter".
  const rngRef = useRef(createRng());
  const [picks, setPicks] = useState({});
  const [slotIndex, setSlotIndex] = useState(0);
  const [name, setName] = useState('');

  const currentSlot = SLOTS[slotIndex];
  const isComplete = slotIndex >= SLOTS.length;

  const chosenOptions = useMemo(
    () =>
      SLOTS.map((slot) => ({
        slot,
        option: slot.options.find((o) => o.id === picks[slot.id]) ?? null,
      })),
    [picks],
  );

  // Preview stat dihitung dari slot yang SUDAH terisi saja. Ini yang membuat
  // pemain melihat build-nya terbentuk sedikit demi sedikit.
  const previewStats = useMemo(
    () => computeStats(chosenOptions.map((e) => e.option).filter(Boolean)),
    [chosenOptions],
  );

  /**
   * Bobot roda saat ini, dihitung ulang setiap `picks` berubah.
   *
   * Nilai yang sama dipakai untuk MENGGAMBAR roda dan untuk MENGUNDI. Kalau
   * keduanya dihitung terpisah, potongan yang terlihat lebar bisa diam-diam
   * punya peluang kecil — bug yang nyaris mustahil disadari lewat pengujian
   * manual karena hasilnya tetap "terlihat acak".
   */
  const weights = useMemo(
    () => (currentSlot ? resolveWeights(currentSlot, picks) : []),
    [currentSlot, picks],
  );

  const pickIndex = useCallback(
    () => pickIndexByWeights(weights, rngRef.current),
    [weights],
  );

  /**
   * Jeda sebelum pindah ke slot berikutnya.
   *
   * Tanpa ini, begitu roda berhenti slot langsung berganti dan hasilnya
   * hilang dari layar sebelum sempat dibaca — momen paling memuaskan dari
   * sebuah roda putar justru terpotong.
   */
  const advanceTimer = useRef(null);
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const handleSettle = useCallback(
    (option) => {
      setPicks((prev) => ({ ...prev, [currentSlot.id]: option.id }));
      clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => setSlotIndex((i) => i + 1), 1100);
    },
    [currentSlot],
  );

  const reset = useCallback(() => {
    clearTimeout(advanceTimer.current);
    setPicks({});
    setSlotIndex(0);
    setName('');
  }, []);

  const spinAll = useCallback(() => {
    clearTimeout(advanceTimer.current);
    const rng = rngRef.current;
    // Berurutan, bukan paralel: bias ras & kelas hanya berlaku kalau keduanya
    // sudah masuk ke `next` sebelum slot berikutnya diundi.
    const next = {};
    for (const slot of SLOTS) {
      next[slot.id] = spinSlot(slot.id, next, rng).option.id;
    }
    setPicks(next);
    setSlotIndex(SLOTS.length);
    setName('');
  }, []);

  const handleSave = useCallback(() => {
    const rng = rngRef.current;
    const trimmed = name.trim();
    const character = createCharacter(picks, rng, {
      name: trimmed || generateName(picks, rng),
    });
    onSave(character);
    reset();
  }, [name, onSave, picks, reset]);

  return (
    <div className="forge">
      <GlassPanel flush>
        {isComplete ? (
          <div className="wheel-stage">
            <div className="wheel-stage__slot">
              <div className="wheel-stage__label">Karakter Siap</div>
              <p className="wheel-stage__hint">
                Power {powerScore(previewStats)} · radius bola{' '}
                {radiusFromMass(previewStats.mass).toFixed(0)}px
              </p>
            </div>

            <div
              style={{
                width: 128,
                height: 128,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle at 32% 28%, #ffffff, #7dd3fc 55%, #1e3a5f)',
                boxShadow: '0 0 48px rgba(125,211,252,0.5)',
              }}
            />

            <input
              className="input"
              style={{ minWidth: 260, textAlign: 'center' }}
              placeholder="Nama karakter (kosongkan untuk acak)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />

            <div className="row">
              <Button variant="primary" onClick={handleSave}>
                Simpan ke roster
              </Button>
              <Button onClick={reset}>Ulang dari awal</Button>
            </div>
          </div>
        ) : (
          <SpinWheel
            slot={currentSlot}
            weights={weights}
            pickIndex={pickIndex}
            onSettle={handleSettle}
            audio={audio}
          />
        )}
      </GlassPanel>

      <div className="stack">
        <GlassPanel
          title="Hasil putaran"
          hint={`${Object.keys(picks).length} dari ${SLOTS.length} slot terisi`}
          actions={
            <Button size="sm" onClick={spinAll}>
              Putar semua
            </Button>
          }
        >
          <div className="picks">
            {chosenOptions.map(({ slot, option }, i) => (
              <div
                key={slot.id}
                className={[
                  'pick',
                  option && 'pick--filled',
                  !option && i === slotIndex && 'pick--active',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--pick-accent': slot.accent }}
              >
                <span className="pick__dot" />
                <span className="pick__slot">{slot.label}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="pick__value">
                    {option ? option.label : i === slotIndex ? 'Giliran ini' : '—'}
                  </span>
                  {option && <p className="pick__blurb">{option.blurb}</p>}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel title="Statistik" hint="Diperbarui tiap putaran">
          <div className="stat-list">
            {STAT_VIEW.map((s) => (
              <StatBar
                key={s.key}
                label={s.label}
                value={previewStats[s.key]}
                max={s.max}
                color={s.color}
                format={s.format}
              />
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
