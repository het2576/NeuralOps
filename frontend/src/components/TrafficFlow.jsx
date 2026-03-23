// NeuralOps — Traffic Flow Visualization (n8n-style, dynamic models)
import { useState, useEffect, useRef } from "react";
import useIsMobile from "../hooks/useIsMobile";

// ── Tier display config (accent, icon) ─────────────────
const TIER_CONFIG = {
  economy:  { accent: '#22c55e', icon: '⚡' },
  standard: { accent: '#f59e0b', icon: '◎' },
  premium:  { accent: '#ef4444', icon: '✦' },
};
const DEFAULT_TIER = { accent: '#8b5cf6', icon: '◆' };

// ── Bezier helper ──────────────────────────────────────
const bezier = (x1, y1, x2, y2) => {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
};

// ── WorkflowNode ───────────────────────────────────────
function WorkflowNode({ icon, title, subtitle, value, accent, healthy = true, pulse = false, style }) {
  const borderColor = healthy ? accent : '#ef4444';
  return (
    <div style={{
      position: 'absolute', width: 180,
      background: '#16161f',
      borderRadius: 10,
      border: `1.5px solid ${borderColor}30`,
      boxShadow: `0 0 0 1px ${borderColor}15, 0 8px 32px rgba(0,0,0,0.4)`,
      overflow: 'hidden',
      ...style,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
        background: `${borderColor}08`, borderBottom: `1px solid ${borderColor}20`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${borderColor}18`, border: `1px solid ${borderColor}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f0', lineHeight: 1.2 }}>{title}</div>
          <div style={{ fontSize: 10, color: '#6b6b8a', fontFamily: 'monospace', marginTop: 1 }}>{subtitle}</div>
        </div>
        <div style={{
          marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: borderColor, boxShadow: `0 0 8px ${borderColor}`,
          animation: pulse ? 'tfPulse 2s ease infinite' : 'none',
        }} />
      </div>
      {/* Body */}
      {value !== undefined && (
        <div style={{ padding: '8px 12px', textAlign: 'center' }}>
          <div style={{
            fontSize: 26, fontWeight: 700, letterSpacing: -1,
            color: healthy ? accent : '#ef4444',
          }}>{value}</div>
        </div>
      )}
      {/* Degraded footer */}
      {!healthy && (
        <div style={{
          background: '#ef444415', borderTop: '1px solid #ef444430',
          padding: '4px 8px', fontSize: 9, fontWeight: 700, color: '#ef4444',
          fontFamily: 'monospace', letterSpacing: 1.5, textAlign: 'center',
        }}>DEGRADED</div>
      )}
      {/* Connection handles */}
      <div style={{
        position: 'absolute', top: '50%', left: -6, transform: 'translateY(-50%)',
        width: 12, height: 12, borderRadius: '50%',
        background: '#16161f', border: `2px solid ${borderColor}`,
      }} />
      <div style={{
        position: 'absolute', top: '50%', right: -6, transform: 'translateY(-50%)',
        width: 12, height: 12, borderRadius: '50%',
        background: '#16161f', border: `2px solid ${borderColor}`,
      }} />
    </div>
  );
}

// ── Default fallback models ────────────────────────────
const FALLBACK_MODELS = [
  { id: 'llama-3.1-8b-instant',   name: 'Llama 3.1 8B',  tier: 'economy',  price_display: '$0.06/1M' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tier: 'standard', price_display: '$0.59/1M' },
  { id: 'qwen/qwen3-32b',         name: 'Qwen 3 32B',    tier: 'premium',  price_display: '$0.90/1M' },
];

// ── Layout constants ───────────────────────────────────
const CANVAS_HEIGHT = 500;
const CANVAS_WIDTH = 900;
const MODEL_NODE_HEIGHT = 130;
const MODEL_NODE_GAP = 20;
const MODEL_X = 640;

// ── Main Component ─────────────────────────────────────
export default function TrafficFlow({ recentRequests = [], stats = null, healthState = {} }) {
  const isMobile = useIsMobile();
  const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
  const [models, setModels] = useState([]);
  const [requestCounts, setRequestCounts] = useState({});
  const [lastRoute, setLastRoute] = useState(null);
  const [lastRequest, setLastRequest] = useState(null);
  const [dotKey, setDotKey] = useState(0);
  const prevLen = useRef(0);

  // ── Fetch models from API ──
  useEffect(() => {
    fetch(`${API}/models`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.models?.length) setModels(data.models);
        else setModels(FALLBACK_MODELS);
      })
      .catch(() => setModels(FALLBACK_MODELS));
  }, [API]);

  // Auto-clear lastRoute after animation
  useEffect(() => {
    if (lastRoute) {
      const timer = setTimeout(() => setLastRoute(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [lastRoute]);

  // Sync request counts from stats
  useEffect(() => {
    if (!stats?.routing_distribution) return;
    setRequestCounts(stats.routing_distribution);
  }, [stats?.routing_distribution?.economy, stats?.routing_distribution?.standard, stats?.routing_distribution?.premium]);

  // Handle new WebSocket requests
  useEffect(() => {
    if (recentRequests.length <= prevLen.current) { prevLen.current = recentRequests.length; return; }
    const newest = recentRequests[0];
    if (!newest) return;
    prevLen.current = recentRequests.length;

    setLastRoute(newest.tier || (newest.complexity === 'SIMPLE' ? 'economy' : newest.complexity === 'MEDIUM' ? 'standard' : 'premium'));
    setDotKey((k) => k + 1);

    fetch(`${API}/history?limit=1`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    })
      .then((r) => r.json())
      .then((data) => {
        const requests = data.requests || data.history || data || [];
        if (requests[0]) {
          setLastRequest({
            text: requests[0].input_text || requests[0].text || requests[0].prompt || requests[0].query || 'Request received',
            complexity: requests[0].complexity,
            tier: requests[0].tier,
            latency: requests[0].latency_ms,
          });
        }
      })
      .catch(() => {});
  }, [recentRequests.length, API]);

  // ── Compute dynamic model positions ──
  const totalHeight = models.length * (MODEL_NODE_HEIGHT + MODEL_NODE_GAP) - MODEL_NODE_GAP;
  const startY = (CANVAS_HEIGHT - totalHeight) / 2;

  const modelPositions = models.map((m, i) => {
    const cfg = TIER_CONFIG[m.tier] || DEFAULT_TIER;
    return {
      ...m,
      accent: cfg.accent,
      icon: cfg.icon,
      x: MODEL_X,
      y: startY + i * (MODEL_NODE_HEIGHT + MODEL_NODE_GAP),
      requests: requestCounts[m.tier] || 0,
    };
  });

  // ── Fixed node positions ──
  const INCOMING_R = { x: 220, y: 250 };
  const BRAIN_L    = { x: 310, y: 250 };
  const BRAIN_R    = { x: 490, y: 250 };

  const complexityColor = (c) => c === 'SIMPLE' ? '#22c55e' : c === 'MEDIUM' ? '#f59e0b' : '#ef4444';

  // ── Dynamic scale for mobile ──
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!isMobile) { setScale(1); return; }
    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        setScale(Math.min(1, w / CANVAS_WIDTH));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isMobile]);

  const scaledHeight = CANVAS_HEIGHT * scale;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: isMobile ? scaledHeight : CANVAS_HEIGHT,
        borderRadius: 16,
        border: '1px solid #1e1e2e',
        overflow: 'hidden',
        background: '#0d0d10',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: isMobile ? 'flex-start' : 'center',
      }}
    >
      <div style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        background: '#0d0d10',
        backgroundImage: 'radial-gradient(circle, #2a2a3a 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        position: 'relative',
        transform: isMobile ? `scale(${scale})` : 'none',
        transformOrigin: isMobile ? 'top left' : 'center center',
        margin: isMobile ? '0' : '0 auto',
      }}>
      {/* ── Last Request Pill ── */}
      {lastRequest && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 100,
          padding: '6px 18px', display: 'flex', gap: 10, alignItems: 'center',
          fontSize: 11, fontFamily: 'monospace', zIndex: 10, whiteSpace: 'nowrap',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: complexityColor(lastRequest.complexity),
            boxShadow: `0 0 6px ${complexityColor(lastRequest.complexity)}`,
          }} />
          <span style={{ color: '#fafafa', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            &ldquo;{lastRequest.text?.slice(0, 45)}{lastRequest.text?.length > 45 ? '...' : ''}&rdquo;
          </span>
          <span style={{
            padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
            background: `${complexityColor(lastRequest.complexity)}20`,
            color: complexityColor(lastRequest.complexity),
          }}>{lastRequest.complexity}</span>
          {lastRequest.latency != null && (
            <span style={{ color: '#6b6b8a' }}>{lastRequest.latency}ms</span>
          )}
        </div>
      )}

      {/* ── SVG Edges ── */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="flowPurple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Incoming → Brain (always animated) */}
        {(() => {
          const d = bezier(INCOMING_R.x, INCOMING_R.y, BRAIN_L.x, BRAIN_L.y);
          return (
            <g>
              <path d={d} fill="none" stroke="#2a2a3a" strokeWidth="2" />
              <path d={d} fill="none" stroke="url(#flowPurple)" strokeWidth="2" strokeDasharray="8 4">
                <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="0.7s" repeatCount="indefinite" />
              </path>
              <foreignObject x={(INCOMING_R.x + BRAIN_L.x) / 2 - 22} y={INCOMING_R.y - 18} width="44" height="18">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  background: '#1a1a28', border: '1px solid #06b6d440', borderRadius: 20,
                  fontSize: 8, color: '#06b6d4', textAlign: 'center', padding: '1px 4px',
                  fontFamily: 'monospace', fontWeight: 600,
                }}>routing</div>
              </foreignObject>
            </g>
          );
        })()}

        {/* Brain → Model edges (dynamic) */}
        {modelPositions.map((model) => {
          const x1 = BRAIN_R.x, y1 = BRAIN_R.y;
          const x2 = model.x, y2 = model.y + 55;
          const isActive = lastRoute === model.tier;
          const dx = Math.abs(x2 - x1) * 0.5;
          const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          return (
            <g key={model.id}>
              {/* Base track */}
              <path d={d} fill="none" stroke={isActive ? model.accent : '#2a2a3a'}
                strokeWidth={isActive ? 2.5 : 1.5} style={{ transition: 'all 0.3s' }} />
              {/* Glow when active */}
              {isActive && (
                <path d={d} fill="none" stroke={model.accent} strokeWidth={6} opacity={0.15}
                  filter="url(#edgeGlow)" />
              )}
              {/* Animated flow when active */}
              {isActive && (
                <path d={d} fill="none" stroke={model.accent} strokeWidth={2.5} strokeDasharray="8 4">
                  <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="0.5s" repeatCount="indefinite" />
                </path>
              )}
              {/* Moving dot when active */}
              {isActive && (
                <circle key={`dot-${model.id}-${dotKey}`} r="5" fill={model.accent} filter="url(#edgeGlow)">
                  <animateMotion dur="0.8s" repeatCount="indefinite" path={d} />
                </circle>
              )}
              {/* Edge label pill */}
              <foreignObject x={midX - 30} y={midY - 10} width="60" height="20">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  background: '#1a1a28',
                  border: `1px solid ${isActive ? model.accent + '60' : '#2a2a3a'}`,
                  borderRadius: 20, fontSize: 9, textAlign: 'center', padding: '2px 6px',
                  fontFamily: 'monospace', fontWeight: 600,
                  color: isActive ? model.accent : '#52525b',
                  transition: 'all 0.3s',
                }}>{model.tier.toUpperCase()}</div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {/* ── Fixed Nodes ── */}
      <WorkflowNode icon="↓" title="Incoming Requests" subtitle="POST /route"
        value={`${stats?.requests_per_minute ?? 0} req/m`}
        accent="#06b6d4" pulse
        style={{ left: 40, top: 195 }} />

      <WorkflowNode icon="◈" title="NeuralOps Brain" subtitle="Complexity Classifier"
        value="AI Router" accent="#a855f7"
        style={{ left: 310, top: 195 }} />

      {/* ── Dynamic Model Nodes ── */}
      {modelPositions.map((model) => (
        <WorkflowNode
          key={model.id}
          icon={model.icon}
          title={model.name}
          subtitle={`${model.tier} · ${model.price_display}`}
          value={model.requests}
          accent={model.accent}
          healthy={healthState?.[model.id] !== false}
          style={{ left: model.x, top: model.y }}
        />
      ))}
      </div>
    </div>
  );
}
