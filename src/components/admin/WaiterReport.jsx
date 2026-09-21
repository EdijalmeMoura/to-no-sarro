import React, { useState, useEffect } from "react";
import { C } from "../../constants/theme.js";
import { brl } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { Card, Btn } from "../ui/index.jsx";

export default function WaiterReport({ store, now }) {
  const [report, setReport] = useState([]);
  const [range, setRange] = useState("hoje");
  const [loading, setLoading] = useState(false);

  const rangeStart = (r) => {
    const DAY = 86400000;
    if (r === "hoje") {
      const d = new Date(); d.setHours(0,0,0,0); return d.getTime();
    }
    if (r === "7") return Date.now() - 7*DAY;
    if (r === "30") return Date.now() - 30*DAY;
    return 0;
  };

  const load = async () => {
    setLoading(true);
    try {
      const from = rangeStart(range);
      const data = await api(`/api/reports/waiters?from=${from}&to=${Date.now()}`);
      setReport(data.report || []);
    } catch (e) {
      store.toast(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [range]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>🧑‍🍳 Relatório Garçons</div>
        <div className="flex gap-2">
          {[
            ["hoje", "Hoje"],
            ["7", "7 dias"],
            ["30", "30 dias"],
            ["tudo", "Tudo"],
          ].map(([v,l]) => (
            <button key={v} onClick={() => setRange(v)} className="rounded-lg px-2 py-1 text-xs font-bold" style={{ background: range===v ? C.orange : C.gray850, color: range===v ? C.black : "#888", border: `1px solid ${range===v ? C.orange : C.gray800}` }}>{l}</button>
          ))}
          <Btn small variant="ghost" onClick={load} disabled={loading}>{loading ? "..." : "Atualizar"}</Btn>
        </div>
      </div>

      {report.length === 0 ? (
        <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>Nenhum dado de garçom no período</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr style={{ color: "#8a8a8a", borderBottom: `1px solid ${C.gray800}` }}>
                <th className="py-2 px-2">Garçom</th>
                <th className="py-2 px-2">Mesas</th>
                <th className="py-2 px-2">Total Vendas</th>
                <th className="py-2 px-2">Taxa Serviço</th>
                <th className="py-2 px-2">Gorjetas</th>
                <th className="py-2 px-2">Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              {report.map(r => (
                <tr key={r.waiterName} className="hover:bg-gray-850" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <td className="py-2 px-2 font-bold text-white">{r.waiterName}</td>
                  <td className="py-2 px-2 text-gray-300">{r.mesas}</td>
                  <td className="py-2 px-2 font-bold" style={{ color: C.yellowLight }}>{brl(r.total)}</td>
                  <td className="py-2 px-2 text-green-400">{brl(r.service)}</td>
                  <td className="py-2 px-2 text-blue-400">{brl(r.tips)}</td>
                  <td className="py-2 px-2 text-gray-400">{brl(r.mesas ? r.total/r.mesas : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
