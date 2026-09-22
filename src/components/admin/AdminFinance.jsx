import React, { useState } from "react";
import { C, CHANNELS } from "../../constants/theme.js";
import { brl } from "../../utils/format.js";
import { downloadCSV } from "../../utils/print.js";
import { Card, Btn, KPI, BarChart, Donut } from "../ui/index.jsx";

const RANGES = [["hoje","Hoje"],["7","7 dias"],["30","30 dias"],["tudo","Tudo"]];
const rangeStart = (range, now) => {
  const d = new Date(now || Date.now());
  d.setHours(0,0,0,0);
  if (range === "hoje") return d.getTime();
  if (range === "7") { d.setDate(d.getDate()-7); return d.getTime(); }
  if (range === "30") { d.setDate(d.getDate()-30); return d.getTime(); }
  return 0;
};

export default function AdminFinance({ store, now }) {
  const [range, setRange] = useState("hoje");
  const from = rangeStart(range, now);
  const valid = store.orders.filter((o) => o.createdAt >= from && o.status !== "CANCELADO");
  const canceled = store.orders.filter((o) => o.createdAt >= from && o.status === "CANCELADO");
  const revenue = valid.reduce((s,o)=>s+o.total,0);
  const discounts = valid.reduce((s,o)=>s+o.discount,0);
  const fees = valid.reduce((s,o)=>s+o.fee,0);
  const ticket = valid.length ? revenue/valid.length : 0;
  const canceledValue = canceled.reduce((s,o)=>s+o.total,0);
  const byDay = {};
  valid.forEach((o)=>{ const k=new Date(o.createdAt).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}); byDay[k]=(byDay[k]||0)+o.total; });
  const dayData = Object.entries(byDay).sort((a,b)=>a[0].split("/").reverse().join("")>b[0].split("/").reverse().join("")?1:-1).slice(-14).map(([d,v])=>({d,v:Math.round(v)}));
  const groupSum = (keyFn)=>{ const m=new Map(); valid.forEach((o)=>{ const k=keyFn(o); m.set(k,(m.get(k)||0)+o.total); }); const total=[...m.values()].reduce((s,v)=>s+v,0)||1; return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k,v,pct:Math.round((v/total)*100)})); };
  const payments = groupSum((o)=>o.payment.replace(/\s*\(.*\)/,""));
  const channels = groupSum((o)=>CHANNELS[o.channel]?.label||o.channel);
  const types = groupSum((o)=>o.type==="pickup"?"Retirada":"Delivery");
  const exportCSV = ()=>{ downloadCSV(`financeiro-sarro-${range}.csv`, [["Faturamento",revenue.toFixed(2)],["Pedidos",valid.length],["Ticket",ticket.toFixed(2)]]); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map(([id,lbl])=><Btn key={id} small variant={range===id?"primary":"dark"} onClick={()=>setRange(id)}>{lbl}</Btn>)}
        <div className="flex-1" /><Btn small variant="dark" onClick={exportCSV}>⬇ Exportar CSV</Btn>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPI icon="💰" label={`Faturamento (${RANGES.find(r=>r[0]===range)?.[1]})`} value={brl(revenue)} accent={C.yellowLight} />
        <KPI icon="🧾" label="Pedidos válidos" value={valid.length} />
        <KPI icon="📦" label="Ticket médio" value={brl(ticket)} />
        <KPI icon="🎟" label="Descontos" value={brl(discounts)} accent={C.orange} />
        <KPI icon="🛵" label="Taxas" value={brl(fees)} />
        <KPI icon="❌" label={`Cancelados · ${brl(canceledValue)}`} value={canceled.length} accent={canceled.length?C.red:C.white} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4"><div style={{color:C.white,fontWeight:800,fontSize:13,marginBottom:12}}>Faturamento por dia</div>{dayData.length?<BarChart data={dayData} xKey="d" vKey="v" />:<div style={{color:"#6a6a6a",fontSize:12}}>Sem vendas</div>}</Card>
        <Card className="p-4"><div style={{color:C.white,fontWeight:800,fontSize:13,marginBottom:12}}>Formas de pagamento</div>{payments.map(p=><div key={p.k} className="mb-2.5"><div className="flex justify-between" style={{fontSize:12}}><span style={{color:"#d0d0d0"}}>{p.k}</span><span style={{color:C.yellowLight,fontWeight:800}}>{brl(p.v)} · {p.pct}%</span></div><div style={{height:6,background:C.gray800,borderRadius:9,marginTop:4}}><div style={{width:`${p.pct}%`,height:"100%",borderRadius:9,background:`linear-gradient(90deg, ${C.orange}, ${C.yellow})`}} /></div></div>)}</Card>
      </div>
    </div>
  );
}
