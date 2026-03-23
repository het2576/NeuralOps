// NeuralOps — Dashboard Component (redesigned)
import { useState, useEffect } from "react";
import { TrendingUp, Zap, Clock, Award, FileText, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from "recharts";
import StatCard from "./StatCard";
import { Card, CardHeader, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { getHistory } from "../api/client";
import useIsMobile from "../hooks/useIsMobile";

// ── Helpers ────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return "just now";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

const COMPLEXITY_BADGE = {
  SIMPLE: "success",
  MEDIUM: "warning",
  COMPLEX: "danger",
};

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");



// ── Dashboard Component ────────────────────────────────
export default function Dashboard({ stats, recentRequests }) {
  const isMobile = useIsMobile();
  const [savingsHistory, setSavingsHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('neuralops_savings_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [initialHistory, setInitialHistory] = useState([]);

  // Cost Alert State
  const [alertThreshold] = useState(0.01);
  const [alertShown, setAlertShown] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (stats?.total_savings > alertThreshold && !alertShown) {
      setShowAlert(true);
      setAlertShown(true);
      setTimeout(() => setShowAlert(false), 5000);
    }
  }, [stats?.total_savings, alertThreshold, alertShown]);

  // PDF Export
  const exportReport = () => {
    const dist = stats?.routing_distribution || { economy: 0, standard: 0, premium: 0 };
    const total = (dist.economy || 0) + (dist.standard || 0) + (dist.premium || 0);
    const pct = (v) => total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
    const costWithout = stats?.total_cost_without_neuralops || 0;
    const actualCost = stats?.total_actual_cost || 0;
    const reportHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>NeuralOps Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Geist', system-ui, sans-serif; background: #fff; color: #09090b; padding: 48px; max-width: 700px; margin: 0 auto; }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.5px; }
  .subtitle { color: #71717a; font-size: 13px; margin-bottom: 32px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #71717a; margin-bottom: 12px; border-bottom: 1px solid #e4e4e7; padding-bottom: 6px; font-family: monospace; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f4f4f5; }
  .row .label { color: #52525b; }
  .row .value { font-weight: 600; font-variant-numeric: tabular-nums; }
  .footer { margin-top: 40px; text-align: center; color: #a1a1aa; font-size: 12px; }
  @media print { body { padding: 24px; } }
</style></head><body>
  <h1>NeuralOps Savings Report</h1>
  <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
  <div class="section">
    <div class="section-title">Summary</div>
    <div class="row"><span class="label">Total Requests</span><span class="value">${stats?.total_requests ?? 0}</span></div>
    <div class="row"><span class="label">Total Saved</span><span class="value">$${(stats?.total_savings ?? 0).toFixed(4)}</span></div>
    <div class="row"><span class="label">Cost Reduction</span><span class="value">${(stats?.total_savings_percentage ?? 0).toFixed(1)}%</span></div>
    <div class="row"><span class="label">Avg Latency</span><span class="value">${Math.round(stats?.avg_latency_ms ?? 0)}ms</span></div>
  </div>
  <div class="section">
    <div class="section-title">Model Distribution</div>
    <div class="row"><span class="label">Economy</span><span class="value">${dist.economy} requests (${pct(dist.economy)}%)</span></div>
    <div class="row"><span class="label">Standard</span><span class="value">${dist.standard} requests (${pct(dist.standard)}%)</span></div>
    <div class="row"><span class="label">Premium</span><span class="value">${dist.premium} requests (${pct(dist.premium)}%)</span></div>
  </div>
  <div class="section">
    <div class="section-title">ROI Analysis</div>
    <div class="row"><span class="label">If all premium</span><span class="value">$${costWithout.toFixed(4)}</span></div>
    <div class="row"><span class="label">With NeuralOps</span><span class="value">$${actualCost.toFixed(4)}</span></div>
    <div class="row"><span class="label">Net Savings</span><span class="value">$${(stats?.total_savings ?? 0).toFixed(4)}</span></div>
  </div>
  <div class="footer">NeuralOps — Route smarter. Spend less. Never go down.</div>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(reportHTML); win.document.close(); win.print(); }
  };

  // Fetch table history from API (on mount + whenever WS delivers a new request)
  const fetchHistory = () => {
    getHistory(20, 0).then((data) => {
      if (data && Array.isArray(data)) {
        setInitialHistory(data.map((r) => ({
          request_id: r.request_id, model_used: r.model_used,
          complexity: r.complexity, tier: r.tier,
          savings: r.savings, savings_percentage: r.savings_percentage,
          latency_ms: r.latency_ms, timestamp: r.timestamp,
          input_text: r.input_text,
        })));
      }
    });
  };

  // Seed savings chart from /history ONLY if localStorage is empty
  useEffect(() => {
    fetchHistory();

    try {
      const existing = localStorage.getItem('neuralops_savings_history');
      if (existing && JSON.parse(existing).length > 0) return;
    } catch {}

    fetch(`${API}/history?limit=50`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    })
      .then((r) => r.json())
      .then((data) => {
        const requests = data.requests || data.history || data || [];
        if (!Array.isArray(requests) || requests.length === 0) return;

        const sorted = [...requests].reverse();
        let cum = 0;
        const points = sorted.map((r) => {
          cum += parseFloat(r.savings || 0);
          return {
            time: new Date(r.created_at || r.timestamp || Date.now())
              .toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
            savings: parseFloat(cum.toFixed(4)),
          };
        });

        setSavingsHistory(points);
        localStorage.setItem('neuralops_savings_history', JSON.stringify(points));
      })
      .catch(() => {});
  }, []);

  // Re-fetch table when WebSocket delivers new requests
  useEffect(() => {
    if (recentRequests.length > 0) {
      fetchHistory();
    }
  }, [recentRequests.length]);

  // Append chart point on WebSocket stats update
  const addChartPoint = (newSavingsTotal) => {
    const newPoint = {
      time: new Date().toLocaleTimeString('en', {
        hour: '2-digit', minute: '2-digit', hour12: false
      }),
      savings: parseFloat(parseFloat(newSavingsTotal).toFixed(4)),
    };
    setSavingsHistory((prev) => {
      const updated = [...prev, newPoint].slice(-50);
      try { localStorage.setItem('neuralops_savings_history', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  useEffect(() => {
    if (stats && stats.total_savings !== undefined) {
      addChartPoint(stats.total_savings);
    }
  }, [stats?.total_savings, stats?.total_requests]);

  const chartData = [
    { name: 'Economy', value: stats?.routing_distribution?.economy || 0, color: '#22c55e', label: 'Llama 3.1 8B' },
    { name: 'Standard', value: stats?.routing_distribution?.standard || 0, color: '#f59e0b', label: 'Llama 3.3 70B' },
    { name: 'Premium', value: stats?.routing_distribution?.premium || 0, color: '#ef4444', label: 'Qwen 3 32B' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Cost Alert Banner */}
      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
              background: 'var(--warning)',
              padding: '10px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#09090b' }}>
              ⚡ Savings milestone reached! ${stats?.total_savings?.toFixed(4) || '0.0000'} saved — routing is working perfectly.
            </span>
            <button onClick={() => setShowAlert(false)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#09090b', opacity: 0.7
            }}>
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={exportReport}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
            color: 'var(--text-secondary)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <FileText size={14} />
          Export Report
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard title="Total Saved" value={stats?.total_savings ? stats.total_savings.toFixed(4) : "0.0000"} prefix="$" subtitle="vs frontier models avg" color="green" icon={TrendingUp} index={0} />
        <StatCard title="Requests Routed" value={stats?.total_requests ?? 0} subtitle="intelligently classified" color="cyan" icon={Zap} index={1} />
        <StatCard title="Avg Latency" value={stats?.avg_latency_ms ? Math.round(stats.avg_latency_ms) : 0} suffix="ms" subtitle="average response time" color="amber" icon={Clock} index={2} />
        <StatCard title="Cost Saved" value={stats?.total_savings_percentage ? stats.total_savings_percentage.toFixed(1) : "0.0"} suffix="%" subtitle="vs GPT-5 / Claude / Gemini" color="indigo" icon={Award} index={3} />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 12 }}>
        {/* Savings Over Time */}
        <Card>
          <CardHeader>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Savings Over Time
            </span>
          </CardHeader>
          <CardContent>
            <div style={{ height: 200 }}>
              {savingsHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={savingsHistory}>
                    <defs>
                      <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={40}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v.toFixed(3)}`}
                      width={55}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#fafafa'
                      }}
                      formatter={(value) => [`$${value.toFixed(4)}`, 'Saved']}
                    />
                    <Area
                      type="monotone"
                      dataKey="savings"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#savingsGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#22c55e' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                  Send requests to see savings grow
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Model Distribution */}
        <Card>
          <CardHeader>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Model Distribution
            </span>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            {chartData.some(d => d.value > 0) ? (
              <>
                <div style={{ padding: '16px 20px 0' }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ left: 10, right: 40, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: '#a1a1aa', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={65}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#fafafa'
                        }}
                        formatter={(value, name, props) => [
                          `${value} requests`,
                          props.payload.label
                        ]}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} fillOpacity={0.85} />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="right"
                          style={{ fill: '#71717a', fontSize: 11 }}
                          formatter={(v) => `${v}`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{
                  display: 'flex', gap: '8px',
                  padding: '12px 20px',
                  borderTop: '1px solid #27272a'
                }}>
                  {chartData.map((item, i) => (
                    <div key={i} style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '8px',
                      background: '#18181b',
                      borderRadius: '8px',
                      border: '1px solid #27272a'
                    }}>
                      <div style={{
                        color: item.color,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 600
                      }}>
                        {item.name.toUpperCase()}
                      </div>
                      <div style={{
                        color: '#fafafa',
                        fontSize: 16,
                        fontWeight: 700,
                        marginTop: 2
                      }}>
                        {stats?.total_requests > 0
                          ? Math.round((item.value / stats.total_requests) * 100)
                          : 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
                No routing data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Requests Table */}
      <Card>
        <CardHeader style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--success)',
            animation: 'livePulse 2s ease infinite',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Recent Requests
          </span>
        </CardHeader>
        <div style={{ overflowX: isMobile ? 'auto' : 'visible' }}>
          {(() => {
            const displayRequests = initialHistory.slice(0, 10);
            if (displayRequests.length === 0) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--text-muted)', fontSize: 13 }}>
                  No requests yet — send one to see live updates
                </div>
              );
            }

            return (
              <div style={{ minWidth: isMobile ? 640 : 'auto' }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 110px 130px 1fr 90px 80px',
                  padding: '10px 20px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                }}>
                  <span>Time</span>
                  <span>Complexity</span>
                  <span>Model</span>
                  <span>Query</span>
                  <span>Latency</span>
                  <span style={{ textAlign: 'right' }}>Savings</span>
                </div>

                {/* Table rows */}
                <AnimatePresence initial={false}>
                  {displayRequests.map((req, i) => {
                    const complexity = req.complexity || 'SIMPLE';
                    const badgeVariant = COMPLEXITY_BADGE[complexity] || 'success';
                    return (
                      <motion.div
                        key={req.request_id || i}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '80px 110px 130px 1fr 90px 80px',
                          padding: '12px 20px',
                          alignItems: 'center',
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.1s',
                          cursor: 'default',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {req.timestamp ? timeAgo(req.timestamp) : 'just now'}
                        </span>
                        <span><Badge variant={badgeVariant}>{complexity}</Badge></span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.model_used || 'Unknown'}
                        </span>
                        <span style={{
                          color: '#71717a',
                          fontSize: 12,
                          fontFamily: 'var(--font-mono)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '300px'
                        }}>
                          {(req.input_text || req.text)?.slice(0, 60) || '—'}
                          {(req.input_text || req.text)?.length > 60 ? '...' : ''}
                        </span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {req.latency_ms || 0}ms
                        </span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 500 }}>
                          {req.complexity === 'COMPLEX'
                            ? <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Optimal</span>
                            : req.savings_percentage > 0
                              ? <span style={{ color: 'var(--success)' }}>{req.savings_percentage?.toFixed(1)}% saved</span>
                              : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                          }
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            );
          })()}
        </div>
      </Card>
    </div>
  );
}
