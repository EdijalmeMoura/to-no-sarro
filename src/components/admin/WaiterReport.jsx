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
    <Card className="p-3 sm:p-4 space-y-3 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }} className="shrink-0">🧑‍🍳 Relatório Garçons</div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
          {[
            ["hoje", "Hoje"],
            ["7", "7 dias"],
            ["30", "30 dias"],
            ["tudo", "Tudo"],
          ].map(([v,l]) => (
            <button key={v} onClick={() => setRange(v)} className="rounded-lg px-2.5 py-1 text-[11px] sm:text-xs font-bold transition" style={{ background: range===v ? C.orange : C.gray850, color: range===v ? C.black : "#888", border: `1px solid ${range===v ? C.orange : C.gray800}` }}>{l}</button>
          ))}
          <Btn small variant="ghost" onClick={load} disabled={loading} className="ml-auto sm:ml-0">{loading ? "..." : "↻"}</Btn>
        </div>
      </div>

      {report.length === 0 ? (
        <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>Nenhum dado de garçom no período</div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid gap-2 sm:hidden">
            {report.map(r => (
              <div key={r.waiterName} className="rounded-xl p-3" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-white text-sm truncate">{r.waiterName}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">{r.mesas} mesas</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2.5">
                  <div><div className="text-[10px] text-gray-500 uppercase">Vendas</div><div className="font-bold text-[13px]" style={{ color: C.yellowLight }}>{brl(r.total)}</div></div>
                  <div><div className="text-[10px] text-gray-500 uppercase">Taxa</div><div className="font-bold text-[13px] text-green-400">{brl(r.service)}</div></div>
                  <div><div className="text-[10px] text-gray-500 uppercase">Ticket</div><div className="font-bold text-[13px] text-gray-300">{brl(r.mesas ? r.total/r.mesas : 0)}</div></div>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: tabela */}
          <div className="hidden sm:block overflow-x-auto -mx-1">
            <table className="w-full text-left text-xs min-w-[520px]">
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
        </>
      )}
    </Card>
  );
}
