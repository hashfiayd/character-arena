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

const STORAGE_KEY = 'character-arena/roster/v1';
const SCHEMA_VERSION = 1;

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

export function loadRoster() {
  if (!isBrowser) return emptyState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();

    const parsed = JSON.parse(raw);
    if (parsed?.version !== SCHEMA_VERSION || !Array.isArray(parsed.characters)) {
      return emptyState();
    }

    return {
      version: SCHEMA_VERSION,
      characters: parsed.characters.filter(isValidCharacter).map((c) => ({
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
