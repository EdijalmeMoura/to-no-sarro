import React, { useState } from "react";
import { C, CHANNELS } from "../../constants/theme.js";
import { brl, fmtDT } from "../../utils/format.js";
import { Card, Btn } from "../ui/index.jsx";
import { Table } from "./_shared.jsx";

const RANGES = [["hoje","Hoje"],["7","7 dias"],["30","30 dias"],["tudo","Tudo"]];
const rangeStart = (range, now) => {
  const d = new Date(now || Date.now());
  d.setHours(0,0,0,0);
  if (range === "hoje") return d.getTime();
  if (range === "7") { d.setDate(d.getDate()-7); return d.getTime(); }
  if (range === "30") { d.setDate(d.getDate()-30); return d.getTime(); }
  return 0;
};

function ReportCard({ title, cols, rows }) {
  return (
    <Card className="p-3">
      <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{title}</div>
      <Table cols={cols} rows={rows} />
    </Card>
  );
}

export default function AdminReports({ store, now }) {
  const [range, setRange] = useState("7");
  const from = rangeStart(range, now);
  const orders = store.orders.filter((o) => o.createdAt >= from);
  const dayMap = new Map();
  orders.forEach((o) => {
    const k = new Date(o.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const cur = dayMap.get(k) || { n: 0, total: 0 };
    cur.n += 1;
    if (o.status !== "CANCELADO") cur.total += o.total;
    dayMap.set(k, cur);
  });
  const salesRows = [...dayMap.entries()].sort((a,b)=>a[0].split("/").reverse().join("")>b[0].split("/").reverse().join("")?1:-1).map(([d,v])=>[d, v.n, brl(v.total), brl(v.n? v.total/v.n:0)]);
  const prodMap = new Map();
  orders.filter((o)=>o.status!=="CANCELADO").forEach((o)=>o.items.forEach((i)=>{ const cur=prodMap.get(i.name)||{qty:0,total:0}; cur.qty+=i.qty; cur.total+=i.unit*i.qty; prodMap.set(i.name,cur); }));
  const productRows = [...prodMap.entries()].sort((a,b)=>b[1].qty-a[1].qty).map(([name,v])=>[name,v.qty,brl(v.total)]);
  const paySet = [...new Set(orders.filter(o=>o.status!=="CANCELADO").map(o=>o.payment))];
  const payRows = paySet.map((pay)=>{ const list=orders.filter(o=>o.payment===pay && o.status!=="CANCELADO"); return [pay, list.length, brl(list.reduce((s,o)=>s+o.total,0))]; });
  const channelRows = Object.keys(CHANNELS).map((k)=>{ const list=orders.filter(o=>o.channel===k && o.status!=="CANCELADO"); return [CHANNELS[k].label, list.length, brl(list.reduce((s,o)=>s+o.total,0))]; });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ color: "#8a8a8a", fontSize: 12 }}>Período:</span>
        {RANGES.map(([id,lbl])=><Btn key={id} small variant={range===id?"primary":"dark"} onClick={()=>setRange(id)}>{lbl}</Btn>)}
      </div>
      <ReportCard title="Vendas por dia" cols={["Dia","Pedidos","Faturamento","Ticket"]} rows={salesRows} />
      <ReportCard title="Produtos vendidos" cols={["Produto","Qtd","Receita"]} rows={productRows} />
      <div className="grid lg:grid-cols-2 gap-3">
        <ReportCard title="Pagamentos" cols={["Pagamento","Pedidos","Total"]} rows={payRows} />
        <ReportCard title="Canais" cols={["Canal","Pedidos","Total"]} rows={channelRows} />
      </div>
    </div>
  );
}
