// NeuralOps — StatCard (shadcn-inspired)
import { motion } from "framer-motion";
import useIsMobile from "../hooks/useIsMobile";

const COLOR_MAP = {
  green:  { accent: 'var(--success)', bg: 'var(--success-bg)' },
  cyan:   { accent: 'var(--info)',    bg: 'var(--info-bg)' },
  amber:  { accent: 'var(--warning)', bg: 'var(--warning-bg)' },
  indigo: { accent: 'var(--brand)',   bg: 'rgba(124,58,237,0.08)' },
};

export default function StatCard({
  title,
  value,
  subtitle,
  color = "indigo",
  icon: Icon,
  prefix = "",
  suffix = "",
  index = 0,
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.indigo;
  const isMobile = useIsMobile();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        position: 'relative',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: isMobile ? 14 : 20,
        overflow: 'hidden',
        cursor: 'default',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-light)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: c.accent,
        borderRadius: '2px 0 0 2px',
      }} />

      {/* Top row: label + icon */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 12,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          {title}
        </span>
        {Icon && (
          <div style={{
            width: 32, height: 32,
            borderRadius: 'var(--radius-md)',
            background: c.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} style={{ color: c.accent }} />
          </div>
        )}
      </div>

      {/* Value */}
      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: isMobile ? 22 : 28,
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.5px',
        marginBottom: 4,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {prefix}{value}{suffix}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}