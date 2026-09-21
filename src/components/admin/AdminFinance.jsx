import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";


function Table({ cols, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="text-left px-3 py-2.5" style={{ color: "#7a7a7a", fontSize: 10.5, fontWeight: 800, borderBottom: `1px solid ${C.gray800}` }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-3" style={{ color: j === 0 ? C.white : "#a5a5a5", fontSize: 12.5, borderBottom: `1px solid ${C.gray850}`, fontWeight: j === 0 ? 700 : 400 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}



function AdminFinance({ store, now }) {
  return <AdminFinanceModular store={store} now={now} />;
}

function printReport(title, cols, rows) {
  const thead = cols.map((c) => `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #000">${c}</th>`).join("");
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:5px 10px;border-bottom:1px solid #ddd">${c ?? ""}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    .sub { color: #444; font-size: 11px; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; }
  </style></head><body>
    <h1>TÔ NO SARRO! — ${title}</h1>
    <div class="sub">Gerado em ${new Date().toLocaleString("pt-BR")}</div>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  </body></html>`;
  const w = window.open("", "_blank", "width=980,height=720");
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 250);
}

function ReportCard({ title, cols, rows, csvName }) {
  const hasData = rows.length > 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>{title}</div>
        <div className="flex gap-1.5 shrink-0">
          <Btn small variant="dark" onClick={() => printReport(title, cols, rows)}>🖨 PDF</Btn>
          <Btn small variant="dark" onClick={() => downloadCSV(csvName, [cols, ...rows])}>⬇ CSV</Btn>
        </div>
      </div>
      {hasData ? <Table cols={cols} rows={rows} /> : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem dados no período.</div>}
    </Card>
  );
}


export default AdminFinance;
