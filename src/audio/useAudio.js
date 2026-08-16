import { useCallback, useEffect, useMemo, useState } from 'react';
import { audioEngine } from './AudioEngine.js';

const STORAGE_KEY = 'character-arena/audio/v1';

const DEFAULTS = { master: 0.7, sfx: 0.9, music: 0.35, muted: false };

function loadSettings() {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      master: clamp01(parsed.master, DEFAULTS.master),
      sfx: clamp01(parsed.sfx, DEFAULTS.sfx),
      music: clamp01(parsed.music, DEFAULTS.music),
      muted: Boolean(parsed.muted),
    };
  } catch {
    return DEFAULTS;
  }
}

const clamp01 = (value, fallback) =>
  typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback;

/**
 * Menjembatani AudioEngine ke React.
 *
 * Yang perlu diperhatikan: audio TIDAK boleh disimpan di state React.
 * AudioEngine adalah singleton di luar React karena ia memegang sumber daya
 * perangkat keras dan harus bertahan lintas render maupun unmount komponen.
 * Yang masuk ke state hanyalah pengaturannya, karena itu yang perlu memicu
 * render ulang.
 */
export function useAudio() {
  const [settings, setSettings] = useState(loadSettings);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    audioEngine.setSettings(settings);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* kuota penuh atau storage diblokir — pengaturan audio tidak kritis */
    }
  }, [settings]);

  /**
   * Membuka kunci audio pada interaksi pertama.
   *
   * Browser menolak memulai AudioContext tanpa gestur pengguna. Listener
   * dipasang di window supaya klik APA PUN membukanya — pemain tidak perlu
   * tahu bahwa ada tombol khusus yang harus ditekan lebih dulu.
   */
  useEffect(() => {
    if (unlocked) return undefined;

    const handler = () => {
      if (audioEngine.unlock()) setUnlocked(true);
    };

    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [unlocked]);

  // Hentikan musik saat tab disembunyikan. Tanpa ini, musik terus berjalan
  // di latar dan terdengar seperti aplikasi yang tidak tahu diri.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) audioEngine.stopMusic();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const api = useMemo(
    () => ({
      play: (name, opts) => audioEngine.play(name, opts),
      startMusic: () => audioEngine.startMusic(),
      stopMusic: () => audioEngine.stopMusic(),
    }),
    [],
  );

  const update = useCallback((partial) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return { settings, update, unlocked, ...api };
}
