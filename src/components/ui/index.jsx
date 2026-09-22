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
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [file, id, v]);
  const srcFile = file ? `/img-up/${file}?v=${v}` : null;
  const srcFallback = `${IMG_BASE}/${id}.jpg?v=${v}`;
  const src = stage === 0 && srcFile ? srcFile : srcFallback;
  if (stage >= 2) {
    return (
      <span className={`flex items-center justify-center w-full h-full ${className}`} style={{ background: `linear-gradient(135deg, ${C.orange}2e, ${C.gray800})`, ...style }}>
        <span style={{ fontSize: fs, lineHeight: 1 }}>{emoji}</span>
      </span>
    );
  }
  return (
    <img src={src} alt={alt} loading="lazy" draggable={false} onError={() => setStage((s) => (s === 0 && srcFile ? 1 : 2))} className={`sarro-img ${className}`} style={style} />
  );
}

export function Badge({ children, color = C.orange, text = C.black }) {
  return <span style={{ background: color, color: text, borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{children}</span>;
}

export function Btn({ children, onClick, variant = "primary", full, disabled, small, style = {}, className = "" }) {
  const base = {
    primary: { background: C.orange, color: C.black },
    ghost: { background: "transparent", color: C.white, border: `1px solid ${C.gray700}` },
    danger: { background: C.red, color: C.white },
    dark: { background: C.gray800, color: C.white, border: `1px solid ${C.gray700}` },
    green: { background: C.green, color: C.black },
  }[variant] || { background: C.orange, color: C.black };
  return (
    <button onClick={onClick} disabled={disabled} className={`active:scale-95 ${className}`} style={{ ...base, opacity: disabled ? 0.5 : 1, width: full ? "100%" : undefined, padding: small ? "6px 12px" : "10px 18px", borderRadius: 10, fontWeight: 800, fontSize: small ? 12 : 14, cursor: disabled ? "not-allowed" : "pointer", border: base.border || "none", transition: "transform 0.1s", ...style }}>
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
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.gray850, color: C.white, padding: "10px 18px", borderRadius: 10, border: `1px solid ${C.gray700}`, zIndex: 9999, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", maxWidth: "90vw", textAlign: "center" }}>
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
    <div style={{ background: C.gray900, border: `1px solid ${C.gray800}`, borderRadius: 12, padding: 12 }} className="sm:p-3.5 flex flex-col justify-between min-h-[86px] sm:min-h-[96px]">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }} className="min-w-0">
        <span style={{ fontSize: 16 }} className="sm:text-[18px] shrink-0">{icon}</span>
        <span style={{ fontSize: 10, color: "#8a8a8a", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.1 }} className="truncate flex-1">{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: accent || C.white, lineHeight: 1.1 }} className="sm:text-[22px] truncate" title={String(value)}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#777", marginTop: 4 }} className="sm:text-[11px] truncate">{sub}</div>}
    </div>
  );
}

export function SyncBadge({ store, now }) {
  return <span style={{ fontSize: 10, color: "#666" }} className="hidden sm:inline">sync {now ? new Date(now).toLocaleTimeString() : ""}</span>;
}

export function BarChart({ data, xKey, vKey, height = 120 }) {
  const max = Math.max(...data.map(d => d[vKey]), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }} className="w-full">
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 28 }} className="group">
          <div className="relative w-full flex justify-center" style={{ height: height - 22 }}>
            <div style={{ width: "100%", maxWidth: 32, background: `linear-gradient(180deg, ${C.yellow}, ${C.orange})`, height: `${(d[vKey]/max)*100}%`, borderRadius: 6, minHeight: 4, position: "absolute", bottom: 0, transition: "height .4s ease" }} className="group-hover:opacity-90" />
            <span className="absolute -top-5 text-[10px] font-bold px-1 py-0.5 rounded" style={{ background: C.gray800, color: C.white, opacity: 0, pointerEvents: "none" }}>{d[vKey]}</span>
          </div>
          <span style={{ fontSize: 10, color: "#888", fontWeight: 600 }} className="truncate w-full text-center">{d[xKey]}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ slices, size = 110 }) {
  const total = slices.reduce((s, sl) => s + sl.v, 0) || 1;
  let acc = 0;
  const grad = slices.map((s) => {
    const start = (acc / total) * 100;
    acc += s.v;
    const end = (acc / total) * 100;
    return `${s.color} ${start}% ${end}%`;
  }).join(", ");
  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(${grad})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} className="shadow-inner">
        <div style={{ width: size*0.58, height: size*0.58, background: C.gray900, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>{slices.length}</span>
          <span style={{ color: "#777", fontSize: 9 }}>canais</span>
        </div>
      </div>
    </div>
  );
}
