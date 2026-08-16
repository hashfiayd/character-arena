/**
 * Kontrol volume.
 *
 * Ditaruh di header, selalu terlihat. Audio yang tidak bisa dimatikan dengan
 * cepat adalah alasan paling umum orang menutup tab — apalagi di project yang
 * mungkin dibuka sambil mendengarkan hal lain.
 */
export function AudioControls({ settings, onChange, unlocked }) {
  return (
    <div className="audio-controls">
      <button
        type="button"
        className="audio-controls__mute"
        onClick={() => onChange({ muted: !settings.muted })}
        aria-pressed={settings.muted}
        title={settings.muted ? 'Bunyikan' : 'Bisukan'}
      >
        {settings.muted ? '🔇' : '🔊'}
      </button>

      <label className="audio-controls__slider" title="Efek suara">
        <span>SFX</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.sfx}
          disabled={settings.muted}
          onChange={(e) => onChange({ sfx: Number(e.target.value) })}
        />
      </label>

      <label className="audio-controls__slider" title="Musik latar">
        <span>BGM</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.music}
          disabled={settings.muted}
          onChange={(e) => onChange({ music: Number(e.target.value) })}
        />
      </label>

      {/*
        Browser melarang audio berbunyi sebelum ada interaksi. Daripada diam
        dan membuat orang mengira audionya rusak, keadaannya dinyatakan.
      */}
      {!unlocked && <span className="audio-controls__hint">klik untuk aktif</span>}
    </div>
  );
}
