/**
 * Primitif UI. Sengaja tipis — hanya membungkus class CSS supaya penamaan
 * konsisten di seluruh fitur, tanpa mengunci logika apa pun ke dalamnya.
 */

export function GlassPanel({ title, hint, actions, children, flush, style }) {
  return (
    <section className={`glass ${flush ? 'glass--flush' : ''}`} style={style}>
      <div className={flush ? '' : 'glass__body'}>
        {(title || actions) && (
          <div className="row row--between" style={{ marginBottom: hint ? 2 : 14 }}>
            {title && <h2 className="glass__title">{title}</h2>}
            {actions}
          </div>
        )}
        {hint && <p className="glass__hint">{hint}</p>}
        {children}
      </div>
    </section>
  );
}

export function Button({
  variant = 'default',
  size,
  block,
  accent,
  children,
  ...rest
}) {
  const classes = [
    'btn',
    variant === 'primary' && 'btn--primary',
    variant === 'danger' && 'btn--danger',
    size === 'sm' && 'btn--sm',
    block && 'btn--block',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      style={accent ? { '--btn-accent': accent } : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Bar statistik.
 * `max` sengaja dilewatkan dari luar, bukan dihitung dari nilai tertinggi
 * karakter saat ini — kalau tidak, bar akan berubah-ubah maknanya setiap kali
 * roster berubah dan perbandingan antar karakter jadi menyesatkan.
 */
export function StatBar({ label, value, max, color, format }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="stat">
      <span className="stat__name">{label}</span>
      <span className="stat__track">
        <span
          className="stat__fill"
          style={{ width: `${pct}%`, '--stat-color': color }}
        />
      </span>
      <span className="stat__value">{format ? format(value) : Math.round(value)}</span>
    </div>
  );
}

export function Tag({ children, title }) {
  return (
    <span className="tag" title={title}>
      {children}
    </span>
  );
}
