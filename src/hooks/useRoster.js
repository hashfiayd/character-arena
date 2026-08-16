import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadRoster, saveRoster } from '../storage/rosterRepository.js';
import { hydrateCharacter } from '../domain/character.js';

/**
 * State roster + persistensi otomatis.
 *
 * `characters` disimpan sebagai data mentah (picks), sementara `hydrated`
 * adalah turunannya yang sudah lengkap dengan stat. Pemisahan ini penting:
 * yang ditulis ke storage hanya bentuk mentahnya, sehingga rebalance angka
 * di data/pools.js otomatis berlaku untuk karakter lama.
 */
export function useRoster() {
  const [characters, setCharacters] = useState(() => loadRoster().characters);

  useEffect(() => {
    saveRoster(characters);
  }, [characters]);

  const hydrated = useMemo(
    () => characters.map(hydrateCharacter),
    [characters],
  );

  const addCharacter = useCallback((character) => {
    setCharacters((prev) => [character, ...prev]);
  }, []);

  const removeCharacter = useCallback((id) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const renameCharacter = useCallback((id, name) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c)),
    );
  }, []);

  /**
   * Mencatat hasil satu pertandingan ke rekor semua peserta.
   * @param {{ winnerIds: string[], scoreboard: Array<{id:string, kills:number}> }} result
   */
  const recordBattle = useCallback((result) => {
    if (!result) return;
    const winners = new Set(result.winnerIds);
    const killsById = new Map(result.scoreboard.map((r) => [r.id, r.kills]));

    setCharacters((prev) =>
      prev.map((c) => {
        if (!killsById.has(c.id)) return c;
        return {
          ...c,
          record: {
            battles: c.record.battles + 1,
            wins: c.record.wins + (winners.has(c.id) ? 1 : 0),
            kills: c.record.kills + killsById.get(c.id),
          },
        };
      }),
    );
  }, []);

  const clearAll = useCallback(() => setCharacters([]), []);

  return {
    characters,
    hydrated,
    addCharacter,
    removeCharacter,
    renameCharacter,
    recordBattle,
    clearAll,
  };
}
