// NeuralOps — ROI Calculator Component (redesigned)
import { useState } from "react";
import { Calculator, TrendingDown, DollarSign, Clock, Percent } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent } from "./ui/Card";
import useIsMobile from "../hooks/useIsMobile";

const formatMoney = (n) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${Math.round(n)}`;
};

const REQUEST_MIX_OPTIONS = [
  { label: "Mostly Simple (80% simple tasks)", savings_pct: 75 },
  { label: "Mixed Workload (50% simple tasks)", savings_pct: 55 },
  { label: "Mostly Complex (20% simple tasks)", savings_pct: 30 },
];

function AnimatedNumber({ value, format = "money", style: extraStyle = {} }) {
  const display =
    format === "money" ? formatMoney(value)
    : format === "days" ? `${value.toFixed(1)} days`
    : format === "pct" ? `${Math.round(value).toLocaleString()}%`
    : value;

  return (
    <motion.span
      key={Math.round(value)}
      initial={{ opacity: 0.4, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      style={extraStyle}
    >
      {display}
    </motion.span>
  );
}

function ResultRow({ label, value, format = "money", highlight = false, color = "green" }) {
  const colorMap = { green: "var(--success)", amber: "var(--warning)", indigo: "var(--brand)" };
  const valueColor = highlight ? (colorMap[color] || "var(--text-primary)") : "var(--text-primary)";

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <AnimatedNumber value={value} format={format} style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: valueColor }} />
    </div>
  );
}

export default function ROICalculator() {
  const isMobile = useIsMobile();
  const [sliderVal, setSliderVal] = useState(62);
  const [mixIndex, setMixIndex] = useState(1);

  const monthlySpend = Math.round(Math.exp(Math.log(500) + (sliderVal / 100) * (Math.log(1000000) - Math.log(500))));
  const savings_pct = REQUEST_MIX_OPTIONS[mixIndex].savings_pct;
  const monthlySavings = monthlySpend * (savings_pct / 100);
  const afterNeuralops = monthlySpend - monthlySavings;
  const annualSavings = monthlySavings * 12;
  const rawFee = monthlySavings * 0.03;
  const neuralopsFee = Math.max(99, Math.min(9999, rawFee));
  const netSavings = monthlySavings - neuralopsFee;
  const paybackDays = monthlySavings > 0 ? (neuralopsFee / monthlySavings) * 30 : 0;
  const roiPct = neuralopsFee > 0 ? (netSavings / neuralopsFee) * 100 : 0;
  const afterPct = monthlySpend > 0 ? (afterNeuralops / monthlySpend) * 100 : 0;
  const savingsPct = 100 - afterPct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calculator size={22} style={{ color: 'var(--brand)' }} />
          ROI Calculator
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>See how much NeuralOps saves you</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* INPUT SECTION */}
        <Card>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Monthly AI Spend</label>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand)', fontFamily: 'var(--font-mono)' }}>
                  {formatMoney(monthlySpend)}/mo
                </span>
              </div>
              <input
                type="range" min={0} max={100} value={sliderVal}
                onChange={(e) => setSliderVal(Number(e.target.value))}
                style={{ width: '100%', height: 6, borderRadius: 'var(--radius-full)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                <span>$500</span><span>$1M</span>
              </div>
            </div>

            {/* Request Mix Dropdown */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>Request Mix</label>
              <select
                value={mixIndex}
                onChange={(e) => setMixIndex(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 16px',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {REQUEST_MIX_OPTIONS.map((opt, i) => (
                  <option key={i} value={i}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Before/After comparison bar */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Before vs After</p>
              <div style={{ position: 'relative', width: '100%', height: 32, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface-3)' }}>
                <motion.div
                  style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'rgba(239,68,68,0.5)' }}
                  animate={{ width: `${afterPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                <motion.div
                  style={{ position: 'absolute', right: 0, top: 0, height: '100%', background: 'rgba(34,197,94,0.5)' }}
                  animate={{ width: `${savingsPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 12, fontWeight: 500, color: 'white', fontFamily: 'var(--font-mono)' }}>
                  <span>{formatMoney(afterNeuralops)}</span>
                  <span>{formatMoney(monthlySavings)} saved</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.5)' }} /> Remaining cost
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: 'rgba(34,197,94,0.5)' }} /> Savings
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { icon: TrendingDown, label: "Cost Reduction", value: `${savings_pct}%`, color: "var(--success)" },
                { icon: Clock,        label: "Payback",        value: paybackDays,       color: "var(--brand)", format: "days" },
                { icon: Percent,      label: "ROI",            value: roiPct,             color: "var(--warning)", format: "pct" },
              ].map((s) => (
                <div key={s.label} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 12, textAlign: 'center' }}>
                  <s.icon size={16} style={{ color: s.color, margin: '0 auto 4px' }} />
                  {s.format ? (
                    <AnimatedNumber value={s.value} format={s.format} style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }} />
                  ) : (
                    <p style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</p>
                  )}
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RESULTS SECTION */}
        <Card>
          <CardHeader style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} style={{ color: 'var(--success)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Your Savings Projection
            </span>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <ResultRow label="Current Monthly Spend" value={monthlySpend} />
              <ResultRow label="After NeuralOps" value={afterNeuralops} highlight color="green" />
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <ResultRow label="Monthly Savings" value={monthlySavings} highlight color="green" />
              <ResultRow label="Annual Savings" value={annualSavings} highlight color="green" />
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <ResultRow label="NeuralOps Fee" value={neuralopsFee} highlight color="amber" />
              <ResultRow label="Net Monthly Savings" value={netSavings} highlight color="green" />
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <ResultRow label="Payback Period" value={paybackDays} format="days" highlight color="green" />
              <ResultRow label="ROI" value={roiPct} format="pct" highlight color="indigo" />
            </div>

            {/* Large ROI highlight */}
            <motion.div
              key={Math.round(roiPct)}
              initial={{ scale: 0.95, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
              style={{
                marginTop: 24, padding: 20, textAlign: 'center',
                background: 'rgba(124,58,237,0.06)',
                border: '1px solid rgba(124,58,237,0.15)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                Return on Investment
              </p>
              <AnimatedNumber
                value={roiPct}
                format="pct"
                style={{ fontSize: 48, fontWeight: 800, color: 'var(--brand)', letterSpacing: '-1px', fontFamily: 'var(--font-sans)' }}
              />
            </motion.div>

            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
              Based on average customer savings data
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
