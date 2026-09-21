import React, { useState, useMemo, memo } from "react";
import { C, FLOW, CHANNELS } from "../../constants/theme.js";
import { Card, Btn, StatusPill, SyncBadge } from "../ui/index.jsx";

// OrderCard memoizado para evitar re-render desnecessário
export const OrderCard = memo(function OrderCard({ o, store, now, compact }) {
  // versão simplificada — o original completo está em App.jsx, aqui usamos props
  const mod = store.getOrderModality ? store.getOrderModality(o) : { badge: o.type, color: C.orange };
  return (
    <div style={{ background: C.gray900, border: `1px solid ${C.gray800}`, borderRadius: 12, padding: compact ? 10 : 14 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontWeight: 800, fontSize: 12, color: C.white }}>#{o.code} · {mod.badge}</span>
        <span style={{ fontSize: 10, color: "#777" }}>{new Date(o.createdAt).toLocaleTimeString()}</span>
      </div>
      <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>{o.customer?.name}</div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{(o.items || []).length} itens · {o.total?.toFixed(2)}</div>
    </div>
  );
});

export default function AdminOrders({ store, now }) {
  const [view, setView] = useState("kanban");
  const [filter, setFilter] = useState("TODOS");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const list = useMemo(() => {
    return store.orders.filter((o) => filter === "TODOS" || o.channel === filter);
  }, [store.orders, filter]);

  const paginated = useMemo(() => {
    if (view === "kanban") return list;
    return list.slice(0, (page+1)*PAGE_SIZE);
  }, [list, page, view]);

  const hasMore = paginated.length < list.length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Btn small variant={view === "kanban" ? "primary" : "ghost"} onClick={() => setView("kanban")}>Kanban</Btn>
        <Btn small variant={view === "lista" ? "primary" : "ghost"} onClick={() => { setView("lista"); setPage(0); }}>Lista</Btn>
        <SyncBadge store={store} now={now} />
        <div className="flex-1" />
        {["TODOS", ...Object.keys(CHANNELS)].map((k) => (
          <button
            key={k}
            onClick={() => { setFilter(k); setPage(0); }}
            className="rounded-lg px-2.5 py-1.5 font-bold"
            style={{
              background: filter === k ? C.gray700 : C.gray850,
              color: filter === k ? C.white : "#8a8a8a",
              border: `1px solid ${C.gray800}`,
              fontSize: 10.5,
            }}
          >
            {k === "TODOS" ? `Todos (${store.orders.length})` : CHANNELS[k].short}
          </button>
        ))}
      </div>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: "thin" }}>
          {FLOW.concat("CANCELADO").map((st) => {
            const items = list.filter((o) => o.status === st);
            return (
              <div key={st} className="shrink-0" style={{ width: 252 }}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <StatusPill status={st} small />
                  <span style={{ color: "#6a6a6a", fontSize: 11, fontWeight: 800 }}>{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.slice(0, 20).map((o) => <OrderCard key={o.id} o={o} store={store} now={now} compact />)}
                  {items.length > 20 && <div style={{ fontSize: 10, color: "#666", textAlign: "center" }}>+ {items.length-20} mais</div>}
                  {items.length === 0 && (
                    <div className="rounded-xl p-4 text-center" style={{ border: `1px dashed ${C.gray800}`, color: "#4a4a4a", fontSize: 11 }}>vazio</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {paginated.map((o) => <OrderCard key={o.id} o={o} store={store} now={now} />)}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Btn small variant="ghost" onClick={() => setPage(p=>p+1)}>Carregar mais ({list.length - paginated.length} restantes)</Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}
