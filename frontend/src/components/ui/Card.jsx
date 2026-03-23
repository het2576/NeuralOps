// NeuralOps — Card UI Component (shadcn-inspired)

export function Card({ children, className = '', style = {}, ...props }) {
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style = {} }) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, style = {} }) {
  return (
    <div style={{ padding: '20px', ...style }}>
      {children}
    </div>
  );
}
