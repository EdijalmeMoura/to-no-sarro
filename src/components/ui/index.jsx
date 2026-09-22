import React, { useState, useEffect } from "react";
import { C } from "../../constants/theme.js";
import { font } from "../../constants/theme.js";

const IMG_BASE = "/img/products";

export function Logo({ size = 44, glow = false, style = {} }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: C.orange, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.display, fontStyle: "italic", color: C.black, fontWeight: 900, fontSize: size*0.35, boxShadow: glow ? `0 0 ${size*0.5}px ${C.orange}` : "none", ...style }}>
      TS
    </div>
  );
}

export function SmartImg({ id, emoji, alt = "", fs = 34, className = "", style = {}, file, v = 0 }) {
  const [stage, setStage] = useState(0); // 0=file, 1=fallback original, 2=emoji
  useEffect(() => setStage(0), [file, id, v]);
  const srcFile = file ? `/img-up/${file}?v=${v}` : null;
  const srcFallback = `${IMG_BASE}/${id}.jpg?v=${v}`;
  const src = stage === 0 && srcFile ? srcFile : srcFallback;

  if (stage >= 2) {
    return (
      <span
        className={`flex items-center justify-center w-full h-full ${className}`}
        style={{ background: `linear-gradient(135deg, ${C.orange}2e, ${C.gray800})`, ...style }}
      >
        <span style={{ fontSize: fs, lineHeight: 1 }}>{emoji}</span>
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setStage((s) => (s === 0 && srcFile ? 1 : 2))}
      className={`sarro-img ${className}`}
      style={style}
    />
  );
}

export function Badge({ children, color = C.orange, text = C.black }) {
  return <span style={{ background: color, color: text, borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{children}</span>;
}

export function Btn({ children, onClick, variant = "primary", full, disabled, small, style = {} }) {
  const base = {
    primary: { background: C.orange, color: C.black },
    ghost: { background: "transparent", color: C.white, border: `1px solid ${C.gray700}` },
    danger: { background: C.red, color: C.white },
    dark: { background: C.gray800, color: C.white, border: `1px solid ${C.gray700}` },
    green: { background: C.green, color: C.black },
  }[variant] || { background: C.orange, color: C.black };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        opacity: disabled ? 0.5 : 1,
        width: full ? "100%" : undefined,
        padding: small ? "6px 12px" : "10px 18px",
        borderRadius: 10,
        fontWeight: 800,
        fontSize: small ? 12 : 14,
        cursor: disabled ? "not-allowed" : "pointer",
        border: base.border || "none",
        transition: "transform 0.1s",
        ...style,
      }}
      className="active:scale-95"
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "", style = {}, onClick }) {
  return (
    <div className={className} onClick={onClick} style={{ background: C.gray900, border: `1px solid ${C.gray800}`, borderRadius: 14, ...style }}>
      {children}
    </div>
  );
}

export function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.gray850, color: C.white, padding: "10px 18px", borderRadius: 10, border: `1px solid ${C.gray700}`, zIndex: 9999, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
      {msg}
    </div>
  );
}

export function Confetti({ on }) {
  if (!on) return null;
  return <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9998 }}>🎉</div>;
}

export function StatusPill({ status, small }) {
  const s = { label: status, color: C.gray700, icon: "•" };
  return (
    <span style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 20, padding: small ? "2px 8px" : "4px 10px", fontSize: small ? 10 : 11, fontWeight: 800 }}>
      {s.icon} {s.label}
    </span>
  );
}

export function WaIcon({ size = 22, color = "#fff", style }) {
  return <span style={{ fontSize: size, color, ...style }}>💬</span>;
}

export function ChannelPill({ channel }) {
  return <span style={{ fontSize: 10, fontWeight: 800, background: "#222", padding: "2px 6px", borderRadius: 6 }}>{channel}</span>;
}

export function KPI({ icon, label, value, sub, accent }) {
  return (
    <div style={{ background: C.gray900, border: `1px solid ${C.gray800}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: "#8a8a8a", fontWeight: 700, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent || C.white }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function SyncBadge({ store, now }) {
  return <span style={{ fontSize: 10, color: "#666" }}>sync {now ? new Date(now).toLocaleTimeString() : ""}</span>;
}

export function BarChart({ data, xKey, vKey, height = 130 }) {
  const max = Math.max(...data.map(d => d[vKey]), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", background: C.orange, height: `${(d[vKey]/max)*100}%`, borderRadius: 4, minHeight: 4 }} />
          <span style={{ fontSize: 10, color: "#777" }}>{d[xKey]}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ slices, size = 118 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(${slices.map(s => `${s.color} ${s.p}%`).join(",")})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: size*0.6, height: size*0.6, background: C.gray900, borderRadius: "50%" }} />
    </div>
  );
}
