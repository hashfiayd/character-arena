/**
 * Repository roster — satu-satunya tempat yang tahu soal localStorage.
 *
 * Kenapa dipisah jadi repository, bukan langsung `localStorage.setItem` di
 * komponen React:
 *   - Storage bisa gagal (mode privat Safari, kuota penuh, storage diblokir).
 *     Kegagalan itu tidak boleh membuat seluruh aplikasi crash.
 *   - Data lama harus bisa dimigrasi saat skema berubah. `version` di sini
 *     adalah kaitnya.
 *   - Kalau nanti pindah ke Firebase/IndexedDB, hanya file ini yang berubah.
 */

import { SLOTS } from '../data/pools.js';

const STORAGE_KEY = 'character-arena/roster/v1';

/**
 * Riwayat skema:
 *   1 — 6 slot (Ras, Kelas, Senjata, Zirah, Sifat, Berkah)
 *   2 — ditambah 4 roda atribut bertingkat
 */
const SCHEMA_VERSION = 2;

const isBrowser = typeof window !== 'undefined' && !!window.localStorage;

/** @returns {{ version: number, characters: import('../domain/character.js').Character[] }} */
function emptyState() {
  return { version: SCHEMA_VERSION, characters: [] };
}

/**
 * Validasi bentuk data. Storage adalah input eksternal yang tidak tepercaya —
 * user bisa saja mengeditnya lewat devtools, atau data dari versi lama tersisa.
 */
function isValidCharacter(value) {
  return (
    value &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.picks &&
    typeof value.picks === 'object'
  );
}

/**
 * Melengkapi karakter lama dengan slot yang belum ada.
 *
 * Ini alasan `version` dipasang sejak awal. Saat empat roda atribut
 * ditambahkan, semua karakter yang sudah tersimpan tiba-tiba kehilangan empat
 * slot. `hydrateCharacter` memang tidak crash — slot yang hilang cuma tersaring
 * keluar — tapi diam-diam menghasilkan karakter tanpa atribut sama sekali:
 * strip pip kosong dan stat lebih lemah dari seharusnya. Bug yang tidak
 * menimbulkan error justru yang paling lama tidak ketahuan.
 *
 * Pilihan alternatifnya adalah menghapus roster lama begitu skema berubah.
 * Itu lebih sederhana, tapi membuang data pemain untuk masalah yang bisa
 * diselesaikan dengan default yang masuk akal.
 *
 * Slot yang hilang diisi opsi TENGAH ("Biasa" untuk tingkatan) — netral, tidak
 * memberi keuntungan maupun kerugian pada karakter lama.
 */
function migrateCharacter(character) {
  const picks = { ...character.picks };
  let changed = false;

  for (const slot of SLOTS) {
    if (picks[slot.id] && slot.options.some((o) => o.id === picks[slot.id])) {
      continue;
    }
    const fallback =
      slot.kind === 'tier'
        ? slot.options.find((o) => o.rank === 2)
        : slot.options[Math.floor(slot.options.length / 2)];
    picks[slot.id] = fallback.id;
    changed = true;
  }

  return changed ? { ...character, picks } : character;
}

export function loadRoster() {
  if (!isBrowser) return emptyState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.characters)) return emptyState();

    // Versi yang LEBIH BARU dari yang dikenal build ini tidak boleh dipaksa
    // dibaca — itu terjadi kalau user membuka tab lama setelah deploy baru,
    // dan menulis ulang datanya justru merusak roster versi barunya.
    if (typeof parsed.version !== 'number' || parsed.version > SCHEMA_VERSION) {
      return emptyState();
    }

    return {
      version: SCHEMA_VERSION,
      characters: parsed.characters
        .filter(isValidCharacter)
        .map(migrateCharacter)
        .map((c) => ({
          ...c,
          record: {
            wins: c.record?.wins ?? 0,
            battles: c.record?.battles ?? 0,
            kills: c.record?.kills ?? 0,
          },
        })),
    };
  } catch (error) {
    console.warn('[roster] gagal membaca storage, memulai dari kosong.', error);
    return emptyState();
  }
}

/** @returns {boolean} true kalau berhasil tersimpan */
export function saveRoster(characters) {
  if (!isBrowser) return false;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, characters }),
    );
    return true;
  } catch (error) {
    // QuotaExceededError paling mungkin terjadi di sini.
    console.warn('[roster] gagal menyimpan.', error);
    return false;
  }
}

export function clearRoster() {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* diabaikan: menghapus yang gagal dibaca bukan kondisi fatal */
  }
}
