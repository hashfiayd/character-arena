import { useState } from 'react';
import { Button, GlassPanel, StatBar } from '../../ui/primitives.jsx';
import { CharacterCard } from './CharacterCard.jsx';
import { createRandomCharacter } from '../../domain/character.js';
import { createRng } from '../../lib/rng.js';

const DETAIL_STATS = [
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

export function RosterPanel({ roster, onAdd, onRemove, onRename, onClear }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = roster.hydrated.find((c) => c.id === selectedId) ?? null;

  const addRandom = (count) => {
    const rng = createRng();
    for (let i = 0; i < count; i++) onAdd(createRandomCharacter(rng));
  };

  return (
    <div className="forge">
      <GlassPanel
        title={`Roster (${roster.hydrated.length})`}
        hint="Karakter tersimpan otomatis di browser ini."
        actions={
          <div className="row">
            <Button size="sm" onClick={() => addRandom(1)}>
              + Acak
            </Button>
            <Button size="sm" onClick={() => addRandom(6)}>
              + 6 Acak
            </Button>
            {roster.hydrated.length > 0 && (
              <Button size="sm" variant="danger" onClick={onClear}>
                Kosongkan
              </Button>
            )}
          </div>
        }
      >
        {roster.hydrated.length === 0 ? (
          <p className="empty">
            Belum ada karakter. Buat lewat tab <strong>Forge</strong>, atau
            tambahkan beberapa karakter acak untuk mencoba arenanya.
          </p>
        ) : (
          <div className="roster-grid">
            {roster.hydrated.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                selected={character.id === selectedId}
                onClick={() =>
                  setSelectedId((id) => (id === character.id ? null : character.id))
                }
              />
            ))}
          </div>
        )}
      </GlassPanel>

      <GlassPanel
        title={selected ? selected.name : 'Detail'}
        hint={selected ? `Power ${selected.power}` : 'Pilih satu karakter di kiri.'}
      >
        {selected ? (
          <div className="stack">
            <input
              className="input"
              value={selected.name}
              onChange={(e) => onRename(selected.id, e.target.value)}
              maxLength={40}
            />

            <div className="stat-list">
              {DETAIL_STATS.map((s) => (
                <StatBar
                  key={s.key}
                  label={s.label}
                  value={selected.stats[s.key]}
                  max={s.max}
                  color={s.color}
                  format={s.format}
                />
              ))}
            </div>

            <div className="picks">
              {selected.options.map(({ slot, option }) => (
                <div
                  key={slot.id}
                  className="pick pick--filled"
                  style={{ '--pick-accent': slot.accent }}
                >
                  <span className="pick__dot" />
                  <span className="pick__slot">{slot.label}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="pick__value">{option.label}</span>
                    <p className="pick__blurb">{option.blurb}</p>
                  </span>
                </div>
              ))}
            </div>

            <Button
              variant="danger"
              block
              onClick={() => {
                onRemove(selected.id);
                setSelectedId(null);
              }}
            >
              Hapus karakter
            </Button>
          </div>
        ) : (
          <p className="empty">Tidak ada yang dipilih.</p>
        )}
      </GlassPanel>
    </div>
  );
}
