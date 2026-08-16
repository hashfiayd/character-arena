import { Tag } from '../../ui/primitives.jsx';

/**
 * Kartu karakter.
 *
 * Dipakai di dua tempat: daftar roster dan pemilihan peserta pertandingan.
 * Karena itu semua perilakunya (klik, badge, warna) dikendalikan lewat props —
 * komponen ini tidak tahu sedang dipakai di layar yang mana.
 */
export function CharacterCard({ character, selected, badge, onClick, color }) {
  const displayColor = color ?? character.color;

  return (
    <button
      type="button"
      className={`char-card ${selected ? 'char-card--selected' : ''}`}
      style={{ '--char-color': displayColor }}
      onClick={onClick}
    >
      {badge && (
        <span className="char-card__badge" style={{ '--char-color': displayColor }}>
          {badge}
        </span>
      )}

      <div className="char-card__head">
        <span className="char-card__orb" style={{ '--char-color': displayColor }} />
        <span className="char-card__name">{character.name}</span>
      </div>

      <div className="char-card__tags">
        {character.options.map(({ slot, option }) => (
          <Tag key={slot.id} title={`${slot.label}: ${option.blurb}`}>
            {option.label}
          </Tag>
        ))}
      </div>

      <div className="char-card__foot">
        <span>Power {character.power}</span>
        <span>
          {character.record.wins}M / {character.record.battles}T ·{' '}
          {character.record.kills} KO
        </span>
      </div>
    </button>
  );
}
