// NeuralOps — Self-Healing Panel Component (redesigned)
import { useState, useEffect } from "react";
import { Shield, AlertTriangle, CheckCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toggleHealth, getHealth } from "../api/client";
import { Card, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import useIsMobile from "../hooks/useIsMobile";

const MODEL_META = [
  { model_key: "llama-3.1-8b-instant",      name: "Llama 3.1 8B",  tier: "Economy",  cost: "$0.06/1M", color: "var(--success)", badge: "success", fallback: "Llama 3.3 70B" },
  { model_key: "llama-3.3-70b-versatile",    name: "Llama 3.3 70B", tier: "Standard", cost: "$0.59/1M", color: "var(--warning)", badge: "warning", fallback: "Qwen 3 32B" },
  { model_key: "qwen/qwen3-32b",             name: "Qwen 3 32B",    tier: "Premium",  cost: "$0.90/1M", color: "var(--danger)",  badge: "danger",  fallback: "Llama 3.3 70B" },
];

function ToggleSwitch({ on, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        position: 'relative',
        width: 40, height: 22,
        borderRadius: 11,
        border: 'none',
        background: on ? 'var(--success)' : 'var(--surface-3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.3s',
        padding: 0,
      }}
    >
      <motion.div
        style={{
          position: 'absolute', top: 3,
          width: 16, height: 16,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
        animate={{ left: on ? 21 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

export default function SelfHealingPanel() {
  const isMobile = useIsMobile();
  const [health, setHealth] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [healingEvents, setHealingEvents] = useState(0);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await getHealth();
      if (data?.models) {
        const map = {};
        data.models.forEach((m) => { map[m.model_key] = m.healthy; });
        setHealth(map);
      }
    })();
  }, []);

  const handleToggle = async (modelKey, currentHealth) => {
    const newHealth = !currentHealth;
    setHealth((prev) => ({ ...prev, [modelKey]: newHealth }));
    setToggling(modelKey);
    setHealingEvents((prev) => prev + 1);

    const model = MODEL_META.find((m) => m.model_key === modelKey);
    const alert = {
      id: Date.now(),
      model: model?.name || modelKey,
      degraded: !newHealth,
      fallback: model?.fallback || "Unknown",
      time: new Date().toLocaleTimeString(),
    };
    setAlerts((prev) => [alert, ...prev].slice(0, 5));
    setTimeout(() => { setAlerts((prev) => prev.filter((a) => a.id !== alert.id)); }, 4000);

    try { await toggleHealth(modelKey, newHealth); }
    catch { setHealth((prev) => ({ ...prev, [modelKey]: currentHealth })); }
    setToggling(null);
  };

  const dismissAlert = (id) => { setAlerts((prev) => prev.filter((a) => a.id !== id)); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} style={{ color: 'var(--brand)' }} />
          Model Health Monitor
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          Toggle models to simulate failures — watch NeuralOps self-heal
        </p>
      </div>

      {/* Alert Banners */}
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
              background: alert.degraded ? 'var(--warning-bg)' : 'var(--success-bg)',
              border: `1px solid ${alert.degraded ? 'var(--warning-border)' : 'var(--success-border)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
              {alert.degraded
                ? <AlertTriangle size={16} style={{ color: 'var(--warning)', marginTop: 2, flexShrink: 0 }} />
                : <CheckCircle size={16} style={{ color: 'var(--success)', marginTop: 2, flexShrink: 0 }} />
              }
              <div style={{ fontSize: 12 }}>
                <p style={{ fontWeight: 600, color: alert.degraded ? 'var(--warning)' : 'var(--success)' }}>
                  {alert.degraded ? "SELF-HEALING ACTIVATED" : "MODEL RECOVERED"}
                </p>
                <p style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                  {alert.degraded
                    ? `${alert.model} degraded at ${alert.time} — traffic → ${alert.fallback}`
                    : `${alert.model} recovered at ${alert.time} — resuming normal routing`}
                </p>
                {alert.degraded && (
                  <p style={{ color: 'var(--text-muted)', marginTop: 2 }}>Zero requests dropped</p>
                )}
              </div>
            </div>
            <button
              onClick={() => dismissAlert(alert.id)}
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Health Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
        {MODEL_META.map((model) => {
          const isHealthy = health[model.model_key] !== false;
          return (
            <motion.div
              key={model.model_key}
              animate={!isHealthy ? { x: [0, -3, 3, -2, 2, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              <Card style={!isHealthy ? { borderColor: 'var(--danger-border)', background: 'var(--danger-bg)' } : {}}>
                <CardContent>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: 'var(--radius-full)',
                        background: isHealthy ? 'var(--success)' : 'var(--danger)',
                      }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{model.name}</span>
                    </div>
                    <ToggleSwitch
                      on={isHealthy}
                      onToggle={() => handleToggle(model.model_key, isHealthy)}
                      disabled={toggling === model.model_key}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge variant={model.badge}>{model.tier}</Badge>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{model.cost}</span>
                  </div>

                  <AnimatePresence mode="wait">
                    {isHealthy ? (
                      <motion.p
                        key="healthy"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ fontSize: 12, color: 'var(--success)', marginTop: 10 }}
                      >
                        Status: Healthy
                      </motion.p>
                    ) : (
                      <motion.div
                        key="degraded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        <p style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
                          ⚠️ DEGRADED — Traffic Rerouted
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          → Fallback: {model.fallback}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Uptime Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', paddingTop: 4, flexWrap: 'wrap' }}>
        <span>System Uptime: <span style={{ color: 'var(--success)', fontWeight: 500 }}>100%</span></span>
        <span>Self-healing events: <span style={{ color: 'var(--warning)', fontWeight: 500 }}>{healingEvents}</span></span>
        <span>Zero downtime maintained</span>
      </div>
    </div>
  );
}
