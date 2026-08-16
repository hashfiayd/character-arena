import { useCallback, useMemo, useState } from 'react';
import { BattleSimulation } from '../../engine/simulation.js';
import { BattleMode } from '../../engine/constants.js';
import { TEAM_COLORS } from '../../domain/character.js';
import { randomSeedString } from '../../lib/rng.js';
import { Button, GlassPanel } from '../../ui/primitives.jsx';
import { CharacterCard } from '../roster/CharacterCard.jsx';
import { ArenaCanvas } from './ArenaCanvas.jsx';

const MODES = [
  { id: BattleMode.FFA, label: 'Battle Royale', min: 2, max: 8, hint: 'Semua lawan semua, terakhir bertahan menang.' },
  { id: BattleMode.DUEL, label: 'Duel 1v1', min: 2, max: 2, hint: 'Dua petarung, satu pemenang.' },
  { id: BattleMode.TEAM, label: 'Tim', min: 4, max: 8, hint: 'Dua tim. Klik lagi kartu terpilih untuk pindah tim.' },
];

export function BattleScreen({ roster, audio, onRecordResult }) {
  const [modeId, setModeId] = useState(BattleMode.FFA);
  const [selectedIds, setSelectedIds] = useState([]);
  const [teamById, setTeamById] = useState({});
  const [seed, setSeed] = useState(randomSeedString);
  const [speed, setSpeed] = useState(1);

  const [simulation, setSimulation] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  // Simulasi bermutasi di luar React. `tick` adalah sinyal eksplisit untuk
  // menggambar ulang panel log/skor — jauh lebih murah daripada menyalin
  // seluruh state simulasi ke dalam state React tiap frame.
  const [, setTick] = useState(0);

  const mode = MODES.find((m) => m.id === modeId);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => roster.hydrated.find((c) => c.id === id))
        .filter(Boolean),
    [roster.hydrated, selectedIds],
  );

  const teamOf = useCallback(
    (id) => teamById[id] ?? selectedIds.indexOf(id) % 2,
    [selectedIds, teamById],
  );

  const validation = useMemo(() => {
    if (selected.length < mode.min) {
      return `Pilih minimal ${mode.min} karakter.`;
    }
    if (selected.length > mode.max) {
      return `Maksimal ${mode.max} karakter untuk mode ini.`;
    }
    if (modeId === BattleMode.TEAM) {
      const teams = new Set(selected.map((c) => teamOf(c.id)));
      if (teams.size < 2) return 'Kedua tim harus terisi.';
    }
    return null;
  }, [mode, modeId, selected, teamOf]);

  const toggleSelect = useCallback(
    (id) => {
      setSelectedIds((prev) => {
        if (!prev.includes(id)) {
          if (prev.length >= mode.max) return prev;
          return [...prev, id];
        }
        // Di mode tim, klik kedua memindahkan tim dulu sebelum melepas pilihan.
        if (modeId === BattleMode.TEAM) {
          const current = teamById[id] ?? prev.indexOf(id) % 2;
          if (current === 0) {
            setTeamById((t) => ({ ...t, [id]: 1 }));
            return prev;
          }
          setTeamById((t) => {
            const next = { ...t };
            delete next[id];
            return next;
          });
        }
        return prev.filter((x) => x !== id);
      });
    },
    [mode.max, modeId, teamById],
  );

  const start = useCallback(() => {
    if (validation) return;

    const characters = selected;
    const sim = new BattleSimulation({
      characters,
      mode: modeId,
      teams:
        modeId === BattleMode.TEAM ? characters.map((c) => teamOf(c.id)) : null,
      seed,
    });

    setResult(null);
    setSimulation(sim);
    setRunning(true);
    audio?.startMusic();
  }, [audio, modeId, seed, selected, teamOf, validation]);

  const handleFinish = useCallback(
    (battleResult) => {
      setResult(battleResult);
      setRunning(false);
      audio?.stopMusic();
      onRecordResult(battleResult);
    },
    [audio, onRecordResult],
  );

  const rematch = useCallback(() => {
    setSeed(randomSeedString());
    setSimulation(null);
    setResult(null);
    setRunning(false);
    audio?.stopMusic();
  }, [audio]);

  return (
    <div className="arena-layout">
      <div className="stack">
        <div className="arena-canvas-wrap">
          <ArenaCanvas
            simulation={simulation}
            running={running}
            speed={speed}
            audio={audio}
            onUpdate={() => setTick((t) => t + 1)}
            onFinish={handleFinish}
          />

          {!simulation && (
            <div className="arena-overlay">
              <h3 className="arena-overlay__title">Arena kosong</h3>
              <p style={{ color: 'var(--text-dim)', margin: 0 }}>
                Pilih peserta di bawah, lalu mulai pertandingan.
              </p>
            </div>
          )}

          {result && (
            <div className="arena-overlay">
              <h3 className="arena-overlay__title">
                {result.reason === 'draw'
                  ? 'Seri'
                  : result.winnerNames.join(' & ')}
              </h3>
              <p style={{ color: 'var(--text-dim)', margin: 0 }}>
                {result.reason === 'timeout'
                  ? 'Menang karena sisa HP terbanyak'
                  : result.reason === 'draw'
                    ? 'Tidak ada yang tersisa'
                    : 'Menang lewat eliminasi'}{' '}
                · {result.duration.toFixed(1)} detik · seed {seed}
              </p>
              <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
                <Button variant="primary" onClick={rematch}>
                  Tanding lagi
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="arena-toolbar">
          <div className="field">
            <span className="field__label">Mode</span>
            <select
              className="select"
              value={modeId}
              onChange={(e) => {
                setModeId(e.target.value);
                setSimulation(null);
                setResult(null);
                setRunning(false);
              }}
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="field__label">Seed</span>
            <input
              className="input"
              style={{ minWidth: 110 }}
              value={seed}
              onChange={(e) => setSeed(e.target.value.toUpperCase())}
              maxLength={12}
            />
          </div>

          <div className="field">
            <span className="field__label">Kecepatan</span>
            <select
              className="select"
              style={{ minWidth: 90 }}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.35}>0.35x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>

          <div className="field">
            <span className="field__label">Kendali</span>
            <div className="row">
              {!simulation || result ? (
                <Button variant="primary" onClick={start} disabled={!!validation}>
                  Mulai
                </Button>
              ) : (
                <>
                  <Button onClick={() => setRunning((r) => !r)}>
                    {running ? 'Jeda' : 'Lanjut'}
                  </Button>
                  <Button onClick={rematch}>Reset</Button>
                </>
              )}
            </div>
          </div>

          {validation && (
            <span style={{ color: 'var(--danger)', fontSize: 12.5, alignSelf: 'flex-end', paddingBottom: 10 }}>
              {validation}
            </span>
          )}
        </div>

        <GlassPanel
          title={`Peserta — ${mode.label}`}
          hint={`${mode.hint} Dipilih: ${selected.length}/${mode.max}.`}
          actions={
            selectedIds.length > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedIds([]);
                  setTeamById({});
                }}
              >
                Bersihkan
              </Button>
            )
          }
        >
          {roster.hydrated.length === 0 ? (
            <p className="empty">
              Roster masih kosong. Buat karakter dulu di tab Forge.
            </p>
          ) : (
            <div className="roster-grid">
              {roster.hydrated.map((character) => {
                const isSelected = selectedIds.includes(character.id);
                const team = teamOf(character.id);
                return (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    selected={isSelected}
                    color={
                      isSelected && modeId === BattleMode.TEAM
                        ? TEAM_COLORS[team % TEAM_COLORS.length]
                        : character.color
                    }
                    badge={
                      isSelected
                        ? modeId === BattleMode.TEAM
                          ? `Tim ${team + 1}`
                          : `#${selectedIds.indexOf(character.id) + 1}`
                        : null
                    }
                    onClick={() => toggleSelect(character.id)}
                  />
                );
              })}
            </div>
          )}
        </GlassPanel>
      </div>

      <div className="stack">
        <GlassPanel title="Skor" hint={simulation ? `t = ${simulation.time.toFixed(1)}s` : 'Belum ada data'}>
          {simulation ? (
            <table className="scoreboard">
              <thead>
                <tr>
                  <th>Petarung</th>
                  <th className="num">HP</th>
                  <th className="num">KO</th>
                  <th className="num">DMG</th>
                </tr>
              </thead>
              <tbody>
                {simulation.list.map((f) => (
                  <tr key={f.id} className={f.hp <= 0 ? 'scoreboard__dead' : ''}>
                    <td>
                      <span className="scoreboard__name">
                        <span
                          className="scoreboard__dot"
                          style={{ background: f.color }}
                        />
                        {f.name}
                      </span>
                    </td>
                    <td className="num">{Math.max(0, Math.round(f.hp))}</td>
                    <td className="num">{f.kills}</td>
                    <td className="num">{Math.round(f.damageDealt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">Mulai pertandingan untuk melihat skor.</p>
          )}
        </GlassPanel>

        <GlassPanel title="Catatan pertandingan">
          {simulation ? (
            <div className="log">
              {[...simulation.log].reverse().map((entry, i) => (
                <div className="log__row" key={`${entry.time}-${i}`}>
                  <span className="log__time">{entry.time.toFixed(1)}s</span>
                  {entry.text}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">Belum ada kejadian.</p>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
