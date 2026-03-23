// NeuralOps — Battle Mode Component (redesigned)
import { useState, useRef, useEffect } from "react";
import { Swords, Loader2, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { runBattle } from "../api/client";
import { Card, CardHeader, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import useIsMobile from "../hooks/useIsMobile";

// ── Tier config ────────────────────────────────────────
const TIER_META = {
  economy:  { label: "ECONOMY",  badge: "success", color: "var(--success)" },
  standard: { label: "STANDARD", badge: "warning", color: "var(--warning)" },
  premium:  { label: "PREMIUM",  badge: "danger",  color: "var(--danger)" },
};

const COST_PER_1M = {
  "llama-3.1-8b-instant": "$0.06",
  "llama-3.3-70b-versatile": "$0.59",
  "qwen/qwen3-32b": "$0.90",
};

// ── Skeleton loader ────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          height: 10, borderRadius: 4,
          background: 'var(--surface-3)',
          width: `${85 - i * 12}%`,
          animation: 'livePulse 2s ease infinite',
        }} />
      ))}
    </div>
  );
}

// ── Single result column ───────────────────────────────
function ResultColumn({ result, isWinner, showResults }) {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER_META[result.tier] || TIER_META.economy;
  const truncated = result.response.length > 150;
  const displayText = expanded
    ? result.response
    : result.response.slice(0, 150) + (truncated ? "..." : "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: showResults ? 1 : 0, y: showResults ? 0 : 30 }}
      transition={{ duration: 0.4 }}
    >
      <Card style={isWinner ? {
        borderColor: 'var(--brand)',
        boxShadow: '0 0 0 1px var(--brand), 0 4px 20px rgba(124,58,237,0.15)',
      } : { opacity: 0.7 }}>
        {/* Header */}
        <CardHeader style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge variant={tier.badge}>{tier.label}</Badge>
            {isWinner && <span style={{ fontSize: 14 }}>🏆</span>}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            {COST_PER_1M[result.model_key] || "—"} /1M
          </span>
        </CardHeader>

        {/* Model name */}
        <div style={{ padding: '16px 16px 8px' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {result.model_name}
          </p>
        </div>

        {/* Response */}
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{
            fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
            maxHeight: expanded ? 'none' : 120, overflow: 'hidden',
            whiteSpace: 'pre-wrap',
          }}>
            {displayText}
          </p>
          {truncated && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, color: 'var(--brand)',
                marginTop: 8, background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Stats footer */}
        <div style={{
          padding: '12px 16px',
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 16, flexWrap: 'wrap',
          borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
        }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>
            ⚡ {result.latency_ms}ms
          </span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            💰 ${result.actual_cost.toFixed(5)}
          </span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 500 }}>
            📊 {result.savings_percentage.toFixed(1)}% cheaper
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

// ── Main BattleMode component ──────────────────────────
export default function BattleMode() {
  const isMobile = useIsMobile();
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [battleResult, setBattleResult] = useState(null);
  const [battleHistory, setBattleHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('neuralops_battle_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [error, setError] = useState(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (battleHistory.length > 0) {
      try { localStorage.setItem('neuralops_battle_history', JSON.stringify(battleHistory.slice(0, 5))); } catch {}
    }
  }, [battleHistory]);

  async function handleFight() {
    const text = inputText.trim();
    if (!text) { setShake(true); setTimeout(() => setShake(false), 500); return; }
    setIsLoading(true); setError(null); setBattleResult(null);
    const result = await runBattle(text);
    if (!result) { setError("Battle failed — try again"); setIsLoading(false); return; }
    setBattleResult(result);
    setBattleHistory((prev) => [{ text, winner: result.neuralops_choice?.model_name }, ...prev].slice(0, 5));
    setIsLoading(false);
  }

  function handleKeyDown(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleFight(); } }
  function handleReset() { setInputText(""); setBattleResult(null); setError(null); inputRef.current?.focus(); }
  function handleHistoryClick(text) { setInputText(text); setBattleResult(null); setError(null); }

  const winnerName = battleResult?.neuralops_choice?.model_name;
  const winnerTier = battleResult?.complexity === "COMPLEX" ? "premium" : battleResult?.complexity === "SIMPLE" ? "economy" : "standard";
  const complexityBadge = { SIMPLE: 'success', MEDIUM: 'warning', COMPLEX: 'danger' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Input Area */}
      <Card>
        <CardContent>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ask anything — watch 3 models compete..."
              style={{
                flex: 1, height: 44,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0 16px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--brand)';
                e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <motion.button
              onClick={handleFight}
              disabled={isLoading}
              animate={shake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
              transition={{ duration: 0.4 }}
              style={{
                height: 44, padding: '0 20px',
                background: 'var(--brand)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                transition: 'background 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.background = '#6d28d9'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {isLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Swords size={14} />}
              {isLoading ? "Fighting..." : "FIGHT"}
            </motion.button>
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </CardContent>
      </Card>

      {/* Result Columns */}
      {(isLoading || battleResult) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
          {isLoading ? (
            [0, 1, 2].map((i) => {
              const tiers = ["economy", "standard", "premium"];
              const names = ["Llama 3.1 8B", "Llama 3.3 70B", "Qwen 3 32B"];
              const tier = TIER_META[tiers[i]];
              return (
                <Card key={i}>
                  <CardHeader style={{ padding: '14px 16px' }}>
                    <Badge variant={tier.badge}>{tier.label}</Badge>
                  </CardHeader>
                  <div style={{ padding: '16px 16px 8px' }}>
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{names[i]}</p>
                  </div>
                  <div style={{ padding: '0 16px 16px' }}><Skeleton /></div>
                </Card>
              );
            })
          ) : (
            battleResult.results.map((r) => (
              <ResultColumn
                key={r.model_key + r.tier}
                result={r}
                isWinner={r.model_name === winnerName && r.tier === winnerTier}
                showResults={true}
              />
            ))
          )}
        </div>
      )}

      {/* Winner Banner */}
      <AnimatePresence>
        {battleResult?.neuralops_choice && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card style={{
              padding: 24, textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.02))',
              borderColor: 'rgba(124,58,237,0.2)',
            }}>
              <p style={{ fontSize: 32 }}>🏆</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 8 }}>
                NeuralOps Chooses
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                {battleResult.neuralops_choice.model_name}
              </p>
              {battleResult.complexity && (
                <div style={{ marginTop: 8 }}>
                  <Badge variant={complexityBadge[battleResult.complexity] || 'default'}>
                    {battleResult.complexity}
                  </Badge>
                </div>
              )}
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                {battleResult.neuralops_choice.winner_reason}
              </p>
              <button
                onClick={handleReset}
                style={{
                  marginTop: 16,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 16px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13, color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <RotateCcw size={14} />
                Fight Again
              </button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle History */}
      {battleHistory.length > 0 && (
        <Card>
          <CardHeader>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Recent Battles
            </span>
          </CardHeader>
          <div>
            {battleHistory.map((b, i) => (
              <button
                key={i}
                onClick={() => handleHistoryClick(b.text)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                  {b.text}
                </span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--brand)', fontWeight: 500 }}>
                  🏆 {b.winner}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
