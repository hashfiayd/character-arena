import { Tag } from '../../ui/primitives.jsx';

/**
 * Warna per tingkat, dipakai di strip atribut.
 * Urutannya mengikuti `rank` 0..4 di data/pools.js.
 */
const TIER_COLORS = ['#64748b', '#94a3b8', '#e2e8f0', '#7dd3fc', '#fcd34d'];

/**
 * Kartu karakter.
 *
 * Dipakai di dua tempat: daftar roster dan pemilihan peserta pertandingan.
 * Karena itu semua perilakunya (klik, badge, warna) dikendalikan lewat props —
 * komponen ini tidak tahu sedang dipakai di layar yang mana.
 *
 * Sejak roda atribut ditambahkan, sebuah karakter punya 10 pilihan. Menampilkan
 * semuanya sebagai tag membuat kartu setinggi dua kali lipat dan tidak terbaca.
 * Jadi keempat atribut diringkas jadi strip empat batang bertingkat, dan hanya
 * pilihan non-tingkat yang tetap jadi tag.
 */
export function CharacterCard({ character, selected, badge, onClick, color }) {
  const displayColor = color ?? character.color;

  const tiers = character.options.filter((e) => e.slot.kind === 'tier');
  const gear = character.options.filter((e) => e.slot.kind !== 'tier');

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

      {tiers.length > 0 && (
        <div className="tier-strip">
          {tiers.map(({ slot, option }) => (
            <span
              key={slot.id}
              className="tier-strip__item"
              title={`${slot.label}: ${option.label} — ${option.blurb}`}
            >
              <span className="tier-strip__name">{slot.label.slice(0, 3)}</span>
              <span className="tier-strip__pips">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="tier-strip__pip"
                    style={{
                      background:
                        i <= option.rank ? TIER_COLORS[option.rank] : 'rgba(255,255,255,0.1)',
                    }}
                  />
                ))}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="char-card__tags">
        {gear.map(({ slot, option }) => (
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
