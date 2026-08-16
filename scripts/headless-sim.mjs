/**
 * Harness simulasi headless.
 *
 * Jalankan: `npm run sim -- --matches 400 --mode ffa --count 6`
 *
 * Gunanya dua:
 *  1. Regression check — memastikan tidak ada pertandingan yang macet, NaN,
 *     atau berakhir tanpa pemenang setelah kamu mengubah angka di constants.js.
 *  2. Analisis balance — melihat opsi mana yang menang jauh di atas rata-rata.
 *
 * Ini mungkin bagian paling berharga dari proyeknya: menyetel game fisika
 * dengan cara menonton satu per satu itu lambat dan bias.
 */

import { BattleSimulation } from '../src/engine/simulation.js';
import { BattleMode, SIM } from '../src/engine/constants.js';
import { createRandomCharacter, hydrateCharacter } from '../src/domain/character.js';
import { createRng } from '../src/lib/rng.js';
import { SLOTS } from '../src/data/pools.js';

function parseArgs(argv) {
  const args = { matches: 300, mode: BattleMode.FFA, count: 6, seed: 12345 };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (key in args) args[key] = key === 'mode' ? value : Number(value);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const rng = createRng(args.seed);

const count = args.mode === BattleMode.DUEL ? 2 : args.count;
const winsByOption = new Map();
const appearances = new Map();

let anomalies = 0;
let draws = 0;
let totalDuration = 0;

const key = (slotId, optionId) => `${slotId}:${optionId}`;

for (let match = 0; match < args.matches; match++) {
  const characters = Array.from({ length: count }, () => createRandomCharacter(rng));

  for (const c of characters) {
    for (const slot of SLOTS) {
      const k = key(slot.id, c.picks[slot.id]);
      appearances.set(k, (appearances.get(k) ?? 0) + 1);
    }
  }

  const teams =
    args.mode === BattleMode.TEAM
      ? characters.map((_, i) => i % 2)
      : null;

  const sim = new BattleSimulation({
    characters,
    mode: args.mode,
    teams,
    seed: Math.floor(rng.next() * 2 ** 31),
  });

  const result = sim.runToCompletion();

  // --- Pemeriksaan kewarasan -------------------------------------------
  if (!result) {
    anomalies++;
    console.error(`[ANOMALI] match ${match}: tidak selesai dalam batas waktu`);
    continue;
  }
  for (const f of sim.list) {
    if (!Number.isFinite(f.pos.x) || !Number.isFinite(f.pos.y) || !Number.isFinite(f.hp)) {
      anomalies++;
      console.error(`[ANOMALI] match ${match}: NaN pada ${f.name}`);
      break;
    }
  }

  totalDuration += result.duration;
  if (result.reason === 'draw') draws++;

  for (const id of result.winnerIds) {
    const c = characters.find((x) => x.id === id);
    if (!c) continue;
    for (const slot of SLOTS) {
      const k = key(slot.id, c.picks[slot.id]);
      winsByOption.set(k, (winsByOption.get(k) ?? 0) + 1);
    }
  }
}

// --- Laporan -------------------------------------------------------------
console.log(`\nMode: ${args.mode} | Petarung: ${count} | Match: ${args.matches}`);
console.log(`Durasi rata-rata : ${(totalDuration / args.matches).toFixed(1)}s`);
console.log(`Seri             : ${draws}`);
console.log(`Anomali          : ${anomalies}`);
console.log(`Batas sudden death: ${SIM.softTimeLimit}s\n`);

const baseline = 1 / count;
const rows = [];
for (const [k, apps] of appearances) {
  if (apps < 15) continue;
  const wins = winsByOption.get(k) ?? 0;
  rows.push({ k, apps, rate: wins / apps, delta: wins / apps - baseline });
}
rows.sort((a, b) => b.rate - a.rate);

console.log('Win rate per opsi (baseline ' + (baseline * 100).toFixed(1) + '%)');
console.log('-'.repeat(58));
for (const row of rows) {
  const pct = (row.rate * 100).toFixed(1).padStart(5);
  const delta = (row.delta * 100).toFixed(1).padStart(6);
  const flag = Math.abs(row.delta) > baseline * 0.55 ? '  <-- cek balance' : '';
  console.log(`${row.k.padEnd(26)} ${pct}%  (${delta}pt, n=${row.apps})${flag}`);
}

// Contoh satu karakter untuk memastikan hidrasi stat masuk akal.
const sample = hydrateCharacter(createRandomCharacter(rng));
console.log('\nContoh karakter:', sample.name, '| power', sample.power);
console.log(
  Object.entries(sample.stats)
    .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`)
    .join('  '),
);

process.exit(anomalies > 0 ? 1 : 0);
