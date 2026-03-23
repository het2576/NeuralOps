// NeuralOps — Main App
import { useState, useEffect } from "react";
import { Zap, LayoutDashboard, Swords, Network, BarChart3, Calculator, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useWebSocket from "./hooks/useWebSocket";
import useIsMobile from "./hooks/useIsMobile";
import { getHealth } from "./api/client";
import Dashboard from "./components/Dashboard";
import BattleMode from "./components/BattleMode";
import TrafficFlow from "./components/TrafficFlow";
import Insights from "./components/Insights";
import ROICalculator from "./components/ROICalculator";
import SelfHealingPanel from "./components/SelfHealingPanel";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Overview & stats" },
  { key: "battle", label: "Battle Mode", icon: Swords, desc: "Compare models live" },
  { key: "traffic", label: "Traffic Map", icon: Network, desc: "Visual routing flow" },
  { key: "insights", label: "Insights", icon: BarChart3, desc: "Analytics & reports" },
  { key: "roi", label: "ROI Calculator", icon: Calculator, desc: "Estimate your savings" },
];

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const WS = API.replace("https://", "wss://").replace("http://", "ws://");

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const { stats, recentRequests, isConnected, lastEvent } = useWebSocket(
    `${WS}/ws`
  );

  const [healthState, setHealthState] = useState({});

  useEffect(() => {
    getHealth().then((data) => {
      if (data?.models) {
        const state = {};
        data.models.forEach((m) => { state[m.model_key] = m.healthy; });
        setHealthState(state);
      }
    });
  }, [lastEvent]);

  // Close menu on resize to desktop
  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleTabSelect = (key) => {
    setActiveTab(key);
    setMenuOpen(false);
  };

  const activeTabData = TABS.find(t => t.key === activeTab);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* ── Navbar ── */}
      <nav style={{
        height: 52,
        background: 'rgba(9,9,11,0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 200,
        padding: isMobile ? '0 12px' : '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            width: 28, height: 28,
            background: 'var(--brand)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={14} color="white" />
          </div>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            NeuralOps
          </span>
        </div>

        {/* Right side: Live badge + hamburger (mobile) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Live badge */}
          <div style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            padding: '4px 10px',
            background: isConnected ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${isConnected ? 'var(--success-border)' : 'var(--danger-border)'}`,
            borderRadius: 'var(--radius-full)',
          }}>
            <span style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: isConnected ? 'var(--success)' : 'var(--danger)',
              animation: isConnected ? 'livePulse 2s ease infinite' : 'none',
            }} />
            <span style={{
              fontSize: 11,
              color: isConnected ? 'var(--success)' : 'var(--danger)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
            }}>
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>

          {/* Hamburger button — mobile only */}
          {isMobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              style={{
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: menuOpen ? 'var(--surface-3)' : 'transparent',
                border: `1px solid ${menuOpen ? 'var(--border-light)' : 'transparent'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all 0.2s',
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {menuOpen ? (
                  <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <X size={18} />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Menu size={18} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </nav>

      {/* ── Mobile Overlay Menu ── */}
      <AnimatePresence>
        {isMobile && menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                top: 52,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                zIndex: 150,
              }}
            />
            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: 52,
                left: 0,
                right: 0,
                zIndex: 160,
                background: 'rgba(17,17,19,0.97)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid var(--border)',
                padding: '8px 0',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              }}
            >
              {TABS.map((tab, i) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <motion.button
                    key={tab.key}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                    onClick={() => handleTabSelect(tab.key)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 20px',
                      background: isActive ? 'rgba(6,182,212,0.08)' : 'transparent',
                      border: 'none',
                      borderLeft: `3px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {/* Icon circle */}
                    <div style={{
                      width: 38, height: 38,
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'rgba(6,182,212,0.15)' : 'var(--surface-2)',
                      border: `1px solid ${isActive ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s',
                    }}>
                      <Icon size={16} style={{ color: isActive ? 'var(--brand)' : 'var(--text-muted)' }} />
                    </div>
                    {/* Label + description */}
                    <div>
                      <div style={{
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        lineHeight: 1.2,
                      }}>
                        {tab.label}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        marginTop: 2,
                      }}>
                        {tab.desc}
                      </div>
                    </div>
                    {/* Active dot */}
                    {isActive && (
                      <div style={{
                        marginLeft: 'auto',
                        width: 6, height: 6,
                        borderRadius: '50%',
                        background: 'var(--brand)',
                        boxShadow: '0 0 8px var(--brand)',
                      }} />
                    )}
                  </motion.button>
                );
              })}
              {/* Current page indicator */}
              <div style={{
                padding: '10px 20px 6px',
                borderTop: '1px solid var(--border)',
                marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-disabled)',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                }}>
                  VIEWING
                </span>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--brand)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                }}>
                  {activeTabData?.label}
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop Tab Bar ── */}
      {!isMobile && (
        <div style={{
          height: 44,
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0,
        }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 14px',
                  height: 44,
                  borderBottom: `2px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  borderBottomStyle: 'solid',
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? 'var(--brand)' : 'transparent',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'var(--surface-2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Mobile: Current tab pill (shown below navbar when menu is closed) ── */}
      {isMobile && !menuOpen && (
        <div style={{
          borderBottom: '1px solid var(--border)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTabData && <activeTabData.icon size={14} style={{ color: 'var(--brand)' }} />}
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}>
              {activeTabData?.label}
            </span>
          </div>
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.15s',
            }}
          >
            Switch
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginTop: 1 }}>
              <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Page Content ── */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? 12 : 24 }}>
        <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
          <Dashboard stats={stats} recentRequests={recentRequests} />
          <div style={{ marginTop: 24 }}>
            <SelfHealingPanel />
          </div>
        </div>
        <div style={{ display: activeTab === 'battle' ? 'block' : 'none' }}>
          <BattleMode />
        </div>
        <div style={{ display: activeTab === 'traffic' ? 'block' : 'none' }}>
          <TrafficFlow stats={stats} recentRequests={recentRequests} healthState={healthState} />
        </div>
        <div style={{ display: activeTab === 'insights' ? 'block' : 'none' }}>
          <Insights isActive={activeTab === 'insights'} />
        </div>
        <div style={{ display: activeTab === 'roi' ? 'block' : 'none' }}>
          <ROICalculator />
        </div>
      </main>
    </div>
  );
}
