import React, { useState, useEffect } from "react";
import { C } from "../../constants/theme.js";
import { api } from "../../utils/api.js";
import { Card } from "../ui/index.jsx";

export default function LowStockAlerts({ store }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api("/api/reports/low-stock");
      setAlerts(data.alerts || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  // Notifica via toast quando estoque crítico
  useEffect(() => {
    const critical = alerts.filter(a => a.critical);
    if (critical.length > 0) {
      // só notifica uma vez por sessão para não spammar
      const key = "stock_alert_" + critical.map(c=>c.id).join(",");
      if (!sessionStorage.getItem(key)) {
        store.toast(`⚠️ Estoque crítico: ${critical.map(c=>c.name).join(", ")}`);
        sessionStorage.setItem(key, "1");
      }
    }
  }, [alerts]);

  if (alerts.length === 0) return null;

  return (
    <Card className="p-3" style={{ borderColor: alerts.some(a=>a.critical) ? `${C.red}88` : `${C.yellow}88`, background: alerts.some(a=>a.critical) ? `${C.red}11` : `${C.yellow}11` }}>
      <div className="flex items-center justify-between mb-2">
        <div style={{ fontWeight: 900, fontSize: 12, color: alerts.some(a=>a.critical) ? C.red : C.yellow }}>⚠️ Estoque Baixo ({alerts.length})</div>
        <button onClick={load} style={{ fontSize: 10, color: "#888" }}>{loading ? "..." : "Atualizar"}</button>
      </div>
      <div className="space-y-1">
        {alerts.slice(0,5).map(a => (
          <div key={a.id} className="flex justify-between text-xs" style={{ color: a.critical ? C.red : "#c9c9c9" }}>
            <span>{a.name}</span>
            <span style={{ fontWeight: 700 }}>{a.qty} / min {a.min} {a.unit}</span>
          </div>
        ))}
        {alerts.length > 5 && <div style={{ fontSize: 10, color: "#666" }}>+ {alerts.length-5} outros</div>}
      </div>
    </Card>
  );
}
