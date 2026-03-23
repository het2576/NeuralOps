// NeuralOps — Insights Tab (redesigned, fully reactive)
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import { getHistory } from "../api/client";
import { Card, CardHeader, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import useIsMobile from "../hooks/useIsMobile";

// ── Helpers ────────────────────────────────────────────
const COMPLEXITY_COLORS = { SIMPLE: "var(--success)", MEDIUM: "var(--warning)", COMPLEX: "var(--danger)" };

const TIER_LABELS = {
  economy:  { label: "Economy",  name: "Llama 3.1 8B",  price: "$0.06/1M",  badge: "success" },
  standard: { label: "Standard", name: "Llama 3.3 70B", price: "$0.59/1M",  badge: "warning" },
  premium:  { label: "Premium",  name: "Qwen 3 32B",    price: "$0.90/1M",  badge: "danger" },
};

const PRICES = {
  economy:  0.00006,   // Llama 3.1 8B  — $0.06/1M tokens
  standard: 0.00059,   // Llama 3.3 70B — $0.59/1M tokens
  premium:  0.00090,   // Qwen 3 32B    — $0.90/1M tokens
};
const BASELINE = 0.00090; // always Qwen 3 32B

const getTier = (model) => {
  if (model?.toLowerCase().includes('3.1') || model?.toLowerCase().includes('8b')) return 'economy';
  if (model?.toLowerCase().includes('70b')) return 'standard';
  return 'premium';
};

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const WS = API.replace("https://", "wss://").replace("http://", "ws://");

export default function Insights({ isActive }) {
  const isMobile = useIsMobile();
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const debounceRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const h = await getHistory(1000, 0);
      const arr = Array.isArray(h) ? h : Array.isArray(h?.requests) ? h.requests : Array.isArray(h?.history) ? h.history : [];
      setHistory(arr);
      setVersion((v) => v + 1);
      setLoaded(true);
    } catch (err) {
      console.error('Insights fetch error:', err);
    }
  }, []);

  // Fetch on mount
  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-fetch when tab becomes active
  useEffect(() => { if (isActive) fetchData(); }, [isActive, fetchData]);

  // WebSocket — re-fetch history on every new_request
  useEffect(() => {
    const ws = new WebSocket(`${WS}/ws`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'new_request' || msg.type === 'stats_update') {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => fetchData(), 250);
        }
      } catch (_) {}
    };

    return () => {
      ws.close();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchData]);

  // ══════════════════════════════════════════════════════
  // ALL derived data — single useMemo from [history]
  // ══════════════════════════════════════════════════════
  const derived = useMemo(() => {
    const total = history.length;

    // ── Complexity distribution ──
    const complexityCounts = { SIMPLE: 0, MEDIUM: 0, COMPLEX: 0 };
    // ── Model counts ──
    const modelCounts = {};
    // ── Tier aggregation ──
    const tierAgg = { economy: { count: 0, saved: 0 }, standard: { count: 0, saved: 0 }, premium: { count: 0, saved: 0 } };
    // ── Cost breakdown per tier ──
    const tierCosts = { economy: { actual: 0, saved: 0 }, standard: { actual: 0, saved: 0 }, premium: { actual: 0, saved: 0 } };
    // ── Latency per tier ──
    const tierLatency = { economy: { sum: 0, count: 0 }, standard: { sum: 0, count: 0 }, premium: { sum: 0, count: 0 } };
    // ── Hour map for expensive hour ──
    const hourMap = {};
    // ── Best saving request ──
    let bestSaving = null;
    // ── Totals ──
    let totalActual = 0;
    let totalBaseline = 0;

    history.forEach((r) => {
      // Complexity
      const c = (r.complexity || "SIMPLE").toUpperCase();
      if (complexityCounts[c] !== undefined) complexityCounts[c]++;

      // Model
      const model = r.model_used || "Unknown";
      modelCounts[model] = (modelCounts[model] || 0) + 1;

      // Tier (use getTier for accurate pricing)
      const tier = r.tier || getTier(model);
      if (tierAgg[tier]) {
        tierAgg[tier].count++;
        tierAgg[tier].saved += parseFloat(r.savings || 0);
      }

      // Token-based cost calculation with correct Groq pricing
      const tokens = (r.tokens_used || r.total_tokens || 500) / 1000;
      const tierPrice = PRICES[tier] || PRICES.premium;
      const actualCost = tokens * tierPrice;
      const baselineCost = tokens * BASELINE;

      if (tierCosts[tier]) {
        tierCosts[tier].actual += actualCost;
        tierCosts[tier].saved += (baselineCost - actualCost);
      }
      if (tierLatency[tier] && r.latency_ms) {
        tierLatency[tier].sum += parseFloat(r.latency_ms);
        tierLatency[tier].count++;
      }

      // Best saving
      if (!bestSaving || parseFloat(r.savings_percentage || 0) > parseFloat(bestSaving.savings_percentage || 0)) {
        bestSaving = r;
      }

      // Hour cost
      if (r.timestamp) {
        const hour = new Date(r.timestamp).getHours();
        hourMap[hour] = (hourMap[hour] || 0) + actualCost;
      }

      // Totals
      totalActual += actualCost;
      totalBaseline += baselineCost;
    });

    // ── Percentages ──
    const simplePct = total > 0 ? Math.round((complexityCounts.SIMPLE / total) * 100) : 0;
    const mediumPct = total > 0 ? Math.round((complexityCounts.MEDIUM / total) * 100) : 0;
    const complexPct = total > 0 ? Math.round((complexityCounts.COMPLEX / total) * 100) : 0;

    // ── Sorted entries ──
    const mostUsedModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0] || null;
    const peakComplexity = Object.entries(complexityCounts).sort((a, b) => b[1] - a[1])[0] || null;
    const expensiveHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0] || null;

    // ── Avg requests/hour ──
    let avgReqsPerHour = 0;
    if (total >= 2) {
      const timestamps = history.filter((r) => r.timestamp).map((r) => new Date(r.timestamp).getTime());
      if (timestamps.length >= 2) {
        const oldest = Math.min(...timestamps);
        const newest = Math.max(...timestamps);
        const hours = Math.max((newest - oldest) / 3600000, 1);
        avgReqsPerHour = +(timestamps.length / hours).toFixed(1);
      }
    }

    // ── Chart: Cost Breakdown ──
    const costData = [
      { name: 'Economy', actual: +tierCosts.economy.actual.toFixed(6), saved: +tierCosts.economy.saved.toFixed(6), color: '#22c55e' },
      { name: 'Standard', actual: +tierCosts.standard.actual.toFixed(6), saved: +tierCosts.standard.saved.toFixed(6), color: '#f59e0b' },
      { name: 'Premium', actual: +tierCosts.premium.actual.toFixed(6), saved: +tierCosts.premium.saved.toFixed(6), color: '#ef4444' },
    ];

    // ── Chart: Avg Latency ──
    const latencyData = [
      { name: 'Llama 3.1 8B\n(Economy)', avg: tierLatency.economy.count ? +(tierLatency.economy.sum / tierLatency.economy.count).toFixed(1) : 0, color: '#22c55e' },
      { name: 'Llama 3.3 70B\n(Standard)', avg: tierLatency.standard.count ? +(tierLatency.standard.sum / tierLatency.standard.count).toFixed(1) : 0, color: '#f59e0b' },
      { name: 'Qwen 3 32B\n(Premium)', avg: tierLatency.premium.count ? +(tierLatency.premium.sum / tierLatency.premium.count).toFixed(1) : 0, color: '#ef4444' },
    ];

    // ── Savings efficiency ──
    const totalSaved = totalBaseline - totalActual;
    const efficiency = totalBaseline > 0 ? (totalSaved / totalBaseline) * 100 : 0;

    // ── Recommendation ──
    let recommendation;
    if (simplePct > 60) recommendation = "Your workload is mostly simple — NeuralOps is saving you maximum money";
    else if (complexPct > 40) recommendation = "High complexity workload detected — premium model correctly prioritized";
    else recommendation = "Balanced workload — NeuralOps optimally routing all tiers";

    return {
      total, complexityCounts, simplePct, mediumPct, complexPct,
      modelCounts, mostUsedModel, peakComplexity,
      tierAgg, bestSaving, expensiveHour, avgReqsPerHour,
      costData, latencyData,
      totalActual, totalBaseline, totalSaved, efficiency,
      recommendation,
    };
  }, [history]);

  // Destructure for cleaner JSX
  const {
    total, simplePct, mediumPct, complexPct,
    mostUsedModel, peakComplexity, bestSaving, expensiveHour, avgReqsPerHour,
    tierAgg, costData, latencyData,
    totalActual, totalBaseline, totalSaved, efficiency,
    recommendation,
  } = derived;

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, color: 'var(--text-muted)' }}>
        Loading insights...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── SECTION 1: Header Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
        <InsightCard label="Most Used Model" value={mostUsedModel ? mostUsedModel[0] : "N/A"} sub={mostUsedModel ? `${mostUsedModel[1]} requests` : ""} color="var(--brand)" />
        <InsightCard label="Peak Complexity" value={peakComplexity ? peakComplexity[0] : "N/A"} sub={peakComplexity ? `${peakComplexity[1]} requests` : ""} color={COMPLEXITY_COLORS[peakComplexity?.[0]] || "var(--text-muted)"} />
        <InsightCard label="Best Saving Request" value={bestSaving ? `${parseFloat(bestSaving.savings_percentage || 0).toFixed(1)}%` : "N/A"} sub={bestSaving ? `${bestSaving.model_used || bestSaving.model || 'Economy'} → ${parseFloat(bestSaving.savings_percentage || 0).toFixed(1)}% cheaper` : "vs premium model"} color="var(--success)" />
        <InsightCard label="Avg Requests/Hour" value={avgReqsPerHour} sub="based on request history" color="var(--info)" />
      </div>

      {/* ── SECTION 2: Complexity Distribution ── */}
      <Card>
        <CardHeader>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Complexity Distribution
          </span>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BarRow label="SIMPLE"  pct={simplePct}  color="var(--success)" />
            <BarRow label="MEDIUM"  pct={mediumPct}  color="var(--warning)" />
            <BarRow label="COMPLEX" pct={complexPct} color="var(--danger)" />
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 3: Model Savings Comparison ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
        {Object.entries(TIER_LABELS).map(([tier, info]) => {
          const agg = tierAgg[tier];
          return (
            <Card key={tier} style={{ transition: 'border-color 0.15s', cursor: 'default' }}>
              <CardContent>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Badge variant={info.badge}>{info.label}</Badge>
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{info.name}</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {agg.count} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>requests</span>
                </p>
                <p style={{ fontSize: 16, fontWeight: 600, color: tier === 'premium' ? 'var(--text-muted)' : 'var(--success)', marginTop: 4 }}>
                  {tier === 'premium'
                    ? <span style={{ fontSize: 13 }}>Baseline model</span>
                    : <><span>{Math.round((1 - PRICES[tier] / BASELINE) * 100)}%</span> <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>cheaper than baseline</span></>
                  }
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── SECTION 4: Cost Breakdown Bar Chart ── */}
      <Card>
        <CardHeader>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Cost Breakdown — Actual vs Saved
          </span>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer key={`cost-${version}`} width="100%" height={220}>
            <BarChart data={costData} barCategoryGap="20%" barGap={4} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(3)}`} width={55} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px', color: '#fafafa' }}
                formatter={(value, name) => [`$${value.toFixed(4)}`, name === 'actual' ? 'Actual Cost' : 'Amount Saved']}
              />
              <Legend formatter={(value) => value === 'actual' ? 'Actual Cost' : 'Amount Saved'} wrapperStyle={{ fontSize: 12, color: '#71717a' }} />
              <Bar dataKey="actual" fill="#06b6d4" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={60} />
              <Bar dataKey="saved" fill="#22c55e" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── SECTION 5: Avg Latency Per Model ── */}
      <Card>
        <CardHeader>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Avg Response Time Per Model
          </span>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer key={`latency-${version}`} width="100%" height={200}>
            <BarChart data={latencyData} layout="vertical" margin={{ left: 10, right: 60, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px', color: '#fafafa' }}
                formatter={(v) => [`${Math.round(v)}ms`, 'Avg Latency']}
              />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {latencyData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── SECTION 6: Intelligence Card ── */}
      <Card style={{ borderColor: 'rgba(124,58,237,0.3)', background: 'linear-gradient(135deg, rgba(124,58,237,0.04), transparent)' }}>
        <CardContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>🧠</span>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>NeuralOps Intelligence Report</p>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Based on your last {total} requests:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
            <p><span style={{ color: 'var(--success)', fontWeight: 600 }}>{simplePct}%</span> of queries are SIMPLE — could use economy model</p>
            <p>You've saved <span style={{ color: 'var(--success)', fontWeight: 600 }}>${totalSaved.toFixed(4)}</span> vs always using premium</p>
            <p>Most expensive hour: <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{expensiveHour ? `${expensiveHour[0]}:00` : "N/A"}</span></p>
            <div style={{
              marginTop: 4, padding: '10px 14px',
              background: 'rgba(124,58,237,0.08)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)', fontWeight: 500,
            }}>
              💡 Recommendation: {recommendation}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 7: Savings Efficiency Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
        <InsightCard label="Total Spent" value={`$${totalActual.toFixed(4)}`} sub="with NeuralOps" color="var(--danger)" />
        <InsightCard label="Total Baseline" value={`$${totalBaseline.toFixed(4)}`} sub="without routing" color="var(--warning)" />
        <InsightCard label="Efficiency" value={`${efficiency.toFixed(1)}%`} sub="cost efficiency" color="var(--success)" />
      </div>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────

function InsightCard({ label, value, sub, color }) {
  return (
    <Card style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: color, borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)' }} />
      <CardContent>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
        {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p>}
      </CardContent>
    </Card>
  );
}

function BarRow({ label, pct, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', width: 64, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'var(--surface-3)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease-out', width: `${Math.max(pct, 0)}%`, background: color }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 40, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}
