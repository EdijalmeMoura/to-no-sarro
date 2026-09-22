import React from "react";
import { C, font, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed } from "../../utils/format.js";
import { Card, Btn, KPI, BarChart, Donut } from "../ui/index.jsx";
import WaiterReport from "./WaiterReport.jsx";
import LowStockAlerts from "./LowStockAlerts.jsx";

const SALES_BY_HOUR = [
  { h: "17h", v: 180 }, { h: "18h", v: 640 }, { h: "19h", v: 1180 },
  { h: "20h", v: 1520 }, { h: "21h", v: 1290 }, { h: "22h", v: 760 }, { h: "23h", v: 310 },
];
const SALES_BY_DAY = [
  { d: "Seg", v: 1820 }, { d: "Ter", v: 2140 }, { d: "Qua", v: 1990 },
  { d: "Qui", v: 2630 }, { d: "Sex", v: 4180 }, { d: "Sáb", v: 5240 }, { d: "Dom", v: 3910 },
];

export default function AdminDashboard({ store, now, setSec }) {
  const today = store.orders.filter((o) => o.status !== "CANCELADO");
  const revenue = today.reduce((s, o) => s + o.total, 0);
  const avg = today.length ? revenue / today.length : 0;
  const counts = (st) => store.orders.filter((o) => o.status === st).length;

  const byChannel = Object.keys(CHANNELS).map((k) => ({
    label: CHANNELS[k].label, color: CHANNELS[k].color,
    v: store.orders.filter((o) => o.channel === k).length || 0.001,
  }));

  const sold = {};
  store.orders.forEach((o) => o.items.forEach((i) => { sold[i.name] = (sold[i.name] || 0) + i.qty; }));
  const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const live = [
    { label: "Aguardando", v: counts("NOVO"), color: C.yellowLight },
    { label: "Na cozinha", v: counts("CONFIRMADO") + counts("PREPARO"), color: C.orange },
    { label: "Prontos", v: counts("PRONTO") + counts("EMBALADO"), color: C.green },
    { label: "Aguardando entregador", v: counts("AGUARDANDO"), color: C.blue },
    { label: "Em entrega", v: counts("ROTA"), color: "#7C5CFF" },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Status Caixa - responsivo: coluna no mobile, linha no sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-3.5 rounded-xl text-xs" style={{ background: C.gray900, border: `1px solid ${C.gray800}` }}>
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <span className="text-xl shrink-0 mt-0.5 sm:mt-0">{store.cashRegister?.status === "OPEN" ? "💵" : "🔒"}</span>
          <div className="min-w-0 flex-1">
            <div className="text-white font-bold text-[13px] sm:text-[13px] leading-tight truncate">
              {store.cashRegister?.status === "OPEN" ? "Frente de Caixa: TURNO EM ANDAMENTO" : "Frente de Caixa: FECHADO"}
            </div>
            <div className="text-gray-400 text-[11px] leading-snug mt-0.5 line-clamp-2 sm:truncate">
              {store.cashRegister?.status === "OPEN"
                ? `Operador: ${store.cashRegister.openedBy} · Esperado: ${brl(store.cashRegister.summary?.expectedCash || 0)}`
                : "Abra o caixa para iniciar o turno no balcão"}
            </div>
          </div>
        </div>
        {setSec && (
          <Btn small variant={store.cashRegister?.status === "OPEN" ? "dark" : "primary"} onClick={() => setSec("caixa")} style={{ alignSelf: "flex-start", whiteSpace: "nowrap" }} className="sm:shrink-0 w-full sm:w-auto">
            {store.cashRegister?.status === "OPEN" ? "Ver Caixa ➔" : "Abrir Caixa ➔"}
          </Btn>
        )}
      </div>

      <Card className="p-3 sm:p-4" style={{ borderColor: `${C.orange}55`, background: `linear-gradient(120deg, ${C.orange}14, ${C.gray850})` }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ width: 8, height: 8, borderRadius: 99, background: C.green, display: "inline-block", animation: "sarropulse 1.6s infinite" }} />
          <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Operação agora</span>
          <span className="ml-auto text-[10px] text-gray-500 sm:hidden">{store.orders.length} pedidos</span>
        </div>
        {/* Responsivo: 2 cols mobile, 3 cols sm, 5 cols lg */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {live.map((l) => (
            <div key={l.label} className="rounded-xl p-2.5 sm:p-3" style={{ background: C.black, border: `1px solid ${l.color}33` }}>
              <div style={{ color: l.color, fontWeight: 900, fontSize: 22 }} className="sm:text-[25px] leading-none">{String(l.v).padStart(2, "0")}</div>
              <div style={{ color: "#8a8a8a", fontSize: 10, marginTop: 4 }} className="leading-tight line-clamp-2">{l.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* KPIs - 1 col xs, 2 cols sm, 3 cols lg */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        <KPI icon="💰" label="Vendas hoje" value={brl(revenue)} sub="+18%" accent={C.yellowLight} />
        <KPI icon="🍔" label="Pedidos hoje" value={today.length} sub="+6%" />
        <KPI icon="📦" label="Ticket médio" value={brl(avg)} />
        <KPI icon="👥" label="Clientes na base" value={store.customers.length} />
        <KPI icon="🛵" label="Entregas em rota" value={counts("ROTA")} />
        <KPI icon="⏱" label="Tempo médio preparo" value="18 min" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4 overflow-hidden">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }} className="flex items-center justify-between">
            <span>Vendas por hora</span>
            <span className="text-[10px] text-gray-500 font-normal">hoje</span>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="min-w-[280px]">
              <BarChart data={SALES_BY_HOUR} xKey="h" vKey="v" />
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 overflow-hidden">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }} className="flex items-center justify-between">
            <span>Vendas na semana</span>
            <span className="text-[10px] text-gray-500 font-normal">últimos 7 dias</span>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="min-w-[280px]">
              <BarChart data={SALES_BY_DAY} xKey="d" vKey="v" />
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Pedidos por canal</div>
            <div className="space-y-2">
              {byChannel.filter(s=>s.v>0.01).map((s)=>(
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2"><span style={{width:8,height:8,borderRadius:99,background:s.color,display:"inline-block"}} />{s.label}</span>
                  <span style={{color:s.color,fontWeight:800}}>{Math.round(s.v)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <Donut slices={byChannel} />
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Produtos mais vendidos</div>
          <div className="space-y-2.5">
            {top.length ? top.map(([name, qty], i) => (
              <div key={name}>
                <div className="flex justify-between gap-2" style={{ fontSize: 12 }}>
                  <span style={{ color: "#d0d0d0" }} className="truncate flex-1 min-w-0">{i+1}. {name}</span>
                  <span style={{ color: C.yellowLight, fontWeight: 800 }} className="shrink-0">{qty}</span>
                </div>
                <div style={{ height: 6, background: C.gray800, borderRadius: 9, marginTop: 4 }}>
                  <div style={{ width: `${(qty / top[0][1]) * 100}%`, height: "100%", borderRadius: 9, background: `linear-gradient(90deg, ${C.orange}, ${C.yellow})` }} />
                </div>
              </div>
            )) : <div style={{color:"#6a6a6a",fontSize:12}}>Sem vendas ainda</div>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
        <WaiterReport store={store} now={now} />
        <LowStockAlerts store={store} />
      </div>
    </div>
  );
}
