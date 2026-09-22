import React, { useState, useMemo } from "react";
import { C, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT } from "../../utils/format.js";
import { printKitchen, printExpedition, printReceipt, printLabel } from "../../utils/print.js";
import { getOrderTableNumber } from "../../utils/mesa.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { Card, Btn } from "../ui/index.jsx";

function StatusPillLocal({ status, small }) {
  const s = STATUS[status] || { label: status, color: "#666", icon: "•" };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-bold"
      style={{
        background: `${s.color}22`,
        color: s.color,
        border: `1px solid ${s.color}55`,
        fontSize: small ? 10 : 11,
        padding: small ? "2px 7px" : "3px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {s.icon} {s.label}
    </span>
  );
}

function ChannelPillLocal({ channel }) {
  const c = CHANNELS[channel] || { short: channel, color: "#888", icon: "•" };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md font-bold"
      style={{
        background: `${c.color}1f`,
        color: c.color,
        fontSize: 10,
        padding: "2px 6px",
        border: `1px solid ${c.color}44`,
        whiteSpace: "nowrap",
      }}
    >
      {c.icon} {c.short}
    </span>
  );
}

function SyncBadgeLocal({ store, now }) {
  const age = Math.max(0, Math.floor((now - (store.lastSyncAt || now)) / 1000));
  const label = age < 5 ? "agora" : age < 60 ? `${age}s atrás` : `${Math.floor(age / 60)}min atrás`;
  const live = store.wsOnline;
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-bold"
        style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: "#9a9a9a", fontSize: 10, whiteSpace: "nowrap" }}
        title={live ? "Tempo real ligado" : "Atualizando a cada 60s"}
      >
        <span style={{ width: 6, height: 6, borderRadius: 99, background: live ? C.green : C.yellow, display: "inline-block", animation: live ? "sarropulse 1.8s infinite" : "none" }} />
        {label}
      </span>
      <button
        onClick={() => store.refreshAll?.(true)}
        className="rounded-lg px-2 py-1 font-bold"
        style={{ background: C.gray800, border: `1px solid ${C.gray700}`, color: C.white, fontSize: 10, whiteSpace: "nowrap" }}
      >
        ↻ Atualizar
      </button>
    </span>
  );
}

function OrderCard({ o, store, now, compact }) {
  const next = FLOW[FLOW.indexOf(o.status) + 1];
  const mesaNum = getOrderTableNumber(o);
  const modality = getOrderModality(o);
  const driver = store.drivers?.find((d) => d.id === o.driverId);
  const mins = (now - o.createdAt) / 60000;
  const late = mins > 25;
  const warn = mins > 12;

  const borderColor = o.status === "CANCELADO" ? `${C.red}55` : late ? C.red : warn ? C.yellow : C.gray800;

  return (
    <Card className="p-3 flex flex-col" style={{ borderColor, borderWidth: late || warn ? 2 : 1 }}>
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span style={{ color: C.white, fontWeight: 900, fontSize: compact ? 13 : 14 }}>#{o.code}</span>
          <ChannelPillLocal channel={o.channel} />
          {mesaNum != null && (
            <span className="rounded-md px-1.5 py-0.5 font-bold" style={{ background: "#064e3b33", color: "#10b981", border: "1px solid #10b98155", fontSize: 9.5 }}>
              🍽️ M{String(mesaNum).padStart(2, "0")}
            </span>
          )}
          {!compact && modality?.id === "pickup" && (
            <span className="rounded-md px-1.5 py-0.5 font-bold" style={{ background: "#1d4ed833", color: "#3b82f6", border: "1px solid #3b82f655", fontSize: 9 }}>
              🏪 BALCÃO
            </span>
          )}
          {o.paymentStatus === "pendente" && (
            <span className="rounded-md px-1.5 py-0.5 font-bold" style={{ background: `${C.yellow}1f`, color: C.yellow, fontSize: 9, border: `1px solid ${C.yellow}44` }}>
              ⏳ PGTO
            </span>
          )}
          {late && o.status !== "ENTREGUE" && o.status !== "CANCELADO" && (
            <span className="rounded-md px-1.5 py-0.5 font-bold" style={{ background: `${C.red}22`, color: C.red, fontSize: 9, border: `1px solid ${C.red}55` }}>
              ATRASADO
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span style={{ color: late ? C.red : "#7a7a7a", fontSize: 10.5, fontWeight: late ? 800 : 400 }}>{elapsed(o.createdAt, now)}</span>
          {!compact && (
            <button
              onClick={() => printReceipt(o, store.settings)}
              title="Cupom cliente"
              className="rounded-md px-1.5 py-0.5"
              style={{ background: C.gray800, color: "#c9c9c9", fontSize: 11 }}
            >
              🖨
            </button>
          )}
        </div>
      </div>

      {/* CLIENTE */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span style={{ color: "#c9c9c9", fontSize: 12, fontWeight: 700 }} className="truncate">{o.customer?.name || "Cliente"}</span>
          {o.customer?.phone && !compact && (
            <span style={{ color: "#5a5a5a", fontSize: 10 }} className="truncate">{o.customer.phone}</span>
          )}
        </div>
        {!compact && (
          <div style={{ color: "#7a7a7a", fontSize: 11, marginTop: 2 }} className="line-clamp-2 leading-tight">
            {o.type === "pickup" ? "🏪 Retirada na loja" : o.customer?.addr}
          </div>
        )}
        {o.tableName && !compact && (
          <div style={{ color: "#10b981", fontSize: 11, marginTop: 2, fontWeight: 700 }}>🍽️ {o.tableName}</div>
        )}
      </div>

      {/* ITENS */}
      <div className="mt-2.5 space-y-1">
        {(o.items || []).slice(0, compact ? 3 : 10).map((i) => (
          <div key={i.id} className="flex gap-1.5">
            <span style={{ color: C.white, fontSize: compact ? 11 : 11.5, fontWeight: 700, minWidth: 22 }}>{i.qty}x</span>
            <span style={{ color: "#9a9a9a", fontSize: compact ? 11 : 11.5 }} className="truncate">
              {i.name}
              {i.opts?.length ? <span style={{ color: C.yellowLight }}> + {i.opts.map((op) => op.name).join(", ")}</span> : null}
              {i.note ? <span style={{ color: C.yellow }}> · {i.note}</span> : null}
            </span>
          </div>
        ))}
        {compact && (o.items || []).length > 3 && (
          <div style={{ color: "#5a5a5a", fontSize: 10.5 }}>+ {o.items.length - 3} itens</div>
        )}
        {o.note && !compact && (
          <div className="rounded-md px-2 py-1 mt-1" style={{ background: `${C.yellow}15`, color: C.yellow, fontSize: 11, border: `1px solid ${C.yellow}33` }}>
            📝 {o.note}
          </div>
        )}
      </div>

      {/* TOTAL + PAGAMENTO */}
      <div className="flex items-center justify-between mt-3 pt-2.5 gap-2" style={{ borderTop: `1px solid ${C.gray850}` }}>
        <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: compact ? 13 : 14 }}>{brl(o.total)}</span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span style={{ color: "#7a7a7a", fontSize: 10 }} className="truncate">{o.payment}</span>
          <span style={{ color: "#4a4a4a", fontSize: 10 }}>•</span>
          <span style={{ color: modality?.color || "#7a7a7a", fontSize: 10, fontWeight: 700 }}>{modality?.icon} {modality?.badge || (o.type === "pickup" ? "RETIRADA" : "DELIVERY")}</span>
        </div>
      </div>

      {/* DRIVER */}
      {driver && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
          <span style={{ fontSize: 12 }}>🛵</span>
          <span style={{ color: C.white, fontSize: 11, fontWeight: 700 }} className="truncate">{driver.name}</span>
          <span style={{ color: "#7a7a7a", fontSize: 10 }}>{driver.vehicle}</span>
        </div>
      )}

      {/* ACTIONS */}
      <div className="mt-3 space-y-2">
        {o.paymentStatus === "pendente" && (
          <div className="grid grid-cols-2 gap-1.5">
            <Btn small variant="primary" full onClick={() => o.payUrl && window.open(o.payUrl, "_blank")} disabled={!o.payUrl}>
              💳 Ver Pagamento
            </Btn>
            <Btn small variant="dark" full onClick={() => store.confirmPaymentManual?.(o.id)}>
              ✓ Confirmar Pgto
            </Btn>
          </div>
        )}

        {next && o.status !== "ENTREGUE" && o.status !== "CANCELADO" && (
          <div className="flex gap-1.5">
            <Btn small full onClick={() => store.advance(o.id)} style={{ fontSize: 11 }}>
              → {STATUS[next]?.label || next}
            </Btn>
            <Btn small variant="danger" onClick={() => { if (confirm(`Cancelar pedido #${o.code}?`)) store.setStatus(o.id, "CANCELADO"); }} style={{ fontSize: 11 }}>
              ✕
            </Btn>
          </div>
        )}

        {o.status === "CANCELADO" && (
          <div className="rounded-md px-2 py-1.5 text-center" style={{ background: `${C.red}15`, color: C.red, fontSize: 11, fontWeight: 700, border: `1px solid ${C.red}33` }}>
            CANCELADO
          </div>
        )}

        {o.status === "ENTREGUE" && (
          <div className="rounded-md px-2 py-1.5 text-center" style={{ background: `${C.green}15`, color: C.green, fontSize: 11, fontWeight: 700 }}>
            ✓ ENTREGUE · {fmtDT(o.createdAt)}
          </div>
        )}

        {!compact && (
          <>
            <div className="grid grid-cols-4 gap-1">
              <button onClick={() => printKitchen(o)} className="rounded-md py-1.5 font-bold" style={{ background: C.gray800, color: "#c9c9c9", fontSize: 10 }} title="Cozinha">🍳</button>
              <button onClick={() => printExpedition(o)} className="rounded-md py-1.5 font-bold" style={{ background: C.gray800, color: "#c9c9c9", fontSize: 10 }} title="Expedição">📦</button>
              <button onClick={() => printReceipt(o, store.settings)} className="rounded-md py-1.5 font-bold" style={{ background: C.gray800, color: "#c9c9c9", fontSize: 10 }} title="Cupom">🧾</button>
              <button onClick={() => printLabel(o)} className="rounded-md py-1.5 font-bold" style={{ background: C.gray800, color: "#c9c9c9", fontSize: 10 }} title="Etiqueta">🏷</button>
            </div>

            {o.status === "AGUARDANDO" && store.drivers?.length > 0 && (
              <div>
                <div style={{ color: "#8a8a8a", fontSize: 10, marginBottom: 4, fontWeight: 700 }}>Atribuir entregador:</div>
                <div className="flex flex-wrap gap-1">
                  {store.drivers.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => store.assignDriver(o.id, d.id)}
                      className="rounded-md px-2 py-1 font-bold"
                      style={{ background: C.gray800, border: `1px solid ${C.gray700}`, color: C.white, fontSize: 10 }}
                    >
                      🛵 {d.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {o.status !== "ENTREGUE" && o.status !== "CANCELADO" && (
              <div className="flex gap-1">
                <select
                  value={o.status}
                  onChange={(e) => store.setStatus(o.id, e.target.value)}
                  className="flex-1 rounded-md px-2 py-1.5 outline-none"
                  style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 11 }}
                >
                  {FLOW.concat("CANCELADO").map((st) => (
                    <option key={st} value={st}>{STATUS[st]?.label || st}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default function AdminOrders({ store, now }) {
  const [view, setView] = useState("kanban");
  const [filter, setFilter] = useState("TODOS");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const list = useMemo(() => {
    let arr = store.orders || [];
    if (filter !== "TODOS") arr = arr.filter((o) => o.channel === filter);
    const term = q.trim().toLowerCase();
    if (term) {
      arr = arr.filter((o) => {
        const hay = `${o.code} ${o.customer?.name || ""} ${o.customer?.phone || ""} ${o.customer?.addr || ""} ${o.payment || ""}`.toLowerCase();
        return hay.includes(term);
      });
    }
    return arr.sort((a, b) => b.createdAt - a.createdAt);
  }, [store.orders, filter, q]);

  const paginated = useMemo(() => (view === "kanban" ? list : list.slice(0, (page + 1) * PAGE_SIZE)), [list, page, view]);
  const hasMore = paginated.length < list.length;

  const counts = useMemo(() => {
    const m = {};
    FLOW.concat("CANCELADO").forEach((st) => (m[st] = 0));
    (store.orders || []).forEach((o) => { if (m[o.status] !== undefined) m[o.status]++; else m[o.status] = 1; });
    return m;
  }, [store.orders]);

  return (
    <div className="space-y-3">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Btn small variant={view === "kanban" ? "primary" : "dark"} onClick={() => { setView("kanban"); setPage(0); }}>Kanban</Btn>
          <Btn small variant={view === "lista" ? "primary" : "dark"} onClick={() => { setView("lista"); setPage(0); }}>Lista</Btn>
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          <SyncBadgeLocal store={store} now={now} />
        </div>

        <div className="flex-1 min-w-[12px]" />

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Buscar #código, cliente, telefone…"
              className="rounded-lg pl-7 pr-3 py-1.5 outline-none w-[200px] sm:w-[240px]"
              style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 11.5 }}
            />
            <span className="absolute left-2.5 top-1.5" style={{ fontSize: 12 }}>🔍</span>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {["TODOS", ...Object.keys(CHANNELS)].map((k) => (
              <button
                key={k}
                onClick={() => { setFilter(k); setPage(0); }}
                className="rounded-lg px-2.5 py-1.5 font-bold transition"
                style={{
                  background: filter === k ? C.gray700 : C.gray850,
                  color: filter === k ? C.white : "#8a8a8a",
                  border: `1px solid ${filter === k ? C.gray700 : C.gray800}`,
                  fontSize: 10.5,
                }}
              >
                {k === "TODOS" ? `Todos (${(store.orders||[]).length})` : CHANNELS[k]?.short || k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RESUMO RAPIDO */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {FLOW.concat("CANCELADO").map((st) => {
          const s = STATUS[st];
          const cnt = counts[st] || 0;
          const isFiltered = list.some((o) => o.status === st) || filter === "TODOS";
          return (
            <div
              key={st}
              className="rounded-lg px-2 py-1.5 flex flex-col items-center"
              style={{
                background: cnt ? `${s.color}14` : C.gray850,
                border: `1px solid ${cnt ? `${s.color}33` : C.gray800}`,
                opacity: isFiltered ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: 11 }}>{s.icon}</span>
              <span style={{ color: cnt ? s.color : "#6a6a6a", fontWeight: 800, fontSize: 13, lineHeight: 1 }}>{cnt}</span>
              <span style={{ color: cnt ? "#c0c0c0" : "#6a6a6a", fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", textAlign: "center", lineHeight: 1.1 }} className="truncate w-full">{s.label}</span>
            </div>
          );
        })}
      </div>

      {list.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <div style={{ fontSize: 40 }}>🔍</div>
          <div style={{ color: C.white, fontWeight: 900, fontSize: 16, marginTop: 10 }}>Nenhum pedido encontrado</div>
          <div style={{ color: "#8a8a8a", fontSize: 12.5, marginTop: 4 }}>
            {q ? `Nenhum resultado para "${q}"` : filter !== "TODOS" ? `Nenhum pedido no canal ${CHANNELS[filter]?.label}` : "Aguardando novos pedidos…"}
          </div>
          {(q || filter !== "TODOS") && (
            <div className="mt-4 flex justify-center gap-2">
              {q && <Btn small variant="dark" onClick={() => setQ("")}>Limpar busca</Btn>}
              {filter !== "TODOS" && <Btn small variant="dark" onClick={() => setFilter("TODOS")}>Ver todos</Btn>}
            </div>
          )}
        </Card>
      ) : view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
          {FLOW.concat("CANCELADO").map((st) => {
            const items = list.filter((o) => o.status === st);
            const s = STATUS[st];
            return (
              <div key={st} className="shrink-0 flex flex-col" style={{ width: 280 }}>
                <div className="flex items-center justify-between mb-2.5 px-1 sticky top-0 z-10 py-1 rounded-lg" style={{ background: C.black }}>
                  <div className="flex items-center gap-1.5">
                    <StatusPillLocal status={st} small />
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 font-bold"
                    style={{ background: items.length ? `${s.color}22` : C.gray850, color: items.length ? s.color : "#6a6a6a", fontSize: 11, border: `1px solid ${items.length ? `${s.color}33` : C.gray800}` }}
                  >
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2.5 flex-1 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 220px)", scrollbarWidth: "thin" }}>
                  {items.map((o) => <OrderCard key={o.id} o={o} store={store} now={now} compact />)}
                  {items.length === 0 && (
                    <div className="rounded-xl p-6 text-center" style={{ border: `1px dashed ${C.gray800}`, color: "#4a4a4a", fontSize: 11 }}>
                      vazio
                    </div>
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
            <div className="mt-5 flex flex-col items-center gap-2">
              <div style={{ color: "#6a6a6a", fontSize: 11 }}>
                Mostrando {paginated.length} de {list.length} pedidos
              </div>
              <Btn small variant="ghost" onClick={() => setPage((p) => p + 1)} style={{ border: `1px solid ${C.gray800}` }}>
                Carregar mais {Math.min(PAGE_SIZE, list.length - paginated.length)} (restam {list.length - paginated.length})
              </Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}
