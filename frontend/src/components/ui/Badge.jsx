// NeuralOps — Badge UI Component (shadcn-inspired)

const VARIANT_STYLES = {
  default: { bg: 'var(--surface-3)', color: 'var(--text-secondary)', border: 'var(--border)' },
  success: { bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-border)' },
  warning: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning-border)' },
  danger:  { bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'var(--danger-border)' },
  info:    { bg: 'var(--info-bg)',    color: 'var(--info)',    border: 'var(--info-border)' },
  brand:   { bg: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: 'rgba(124,58,237,0.25)' },
};

export function Badge({ children, variant = 'default' }) {
  const s = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: '11px',
        fontWeight: '500',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.5px',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {children}
    </span>
  );
}
