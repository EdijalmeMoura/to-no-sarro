import React, { useState } from "react";
import QRCode from "qrcode";
import { C, font } from "../../constants/theme.js";
import { brl, elapsed } from "../../utils/format.js";
import { buildMesaIndex } from "../../utils/mesa.js";
import { api } from "../../utils/api.js";
import { printHTML } from "../../utils/print.js";
import { Card, KPI, Btn } from "../ui/index.jsx";

export default function AdminTables({ store, now }) {
  const [filter, setFilter] = useState("TODAS"); // TODAS | LIVRES | OCUPADAS
  const [openModal, setOpenModal] = useState(null); // { tableNum, tableName }
  const [closeModal, setCloseModal] = useState(null); // table object to close
  const [addItemModal, setAddItemModal] = useState(null); // table object to append items
  const [transferModal, setTransferModal] = useState(null); // table object to transfer
  const [targetTable, setTargetTable] = useState("");
  const [qrSingle, setQrSingle] = useState(null); // table object for QR preview
  const [qrAllModal, setQrAllModal] = useState(false); // all QR codes modal
  const [custName, setCustName] = useState("");
  const [cartItems, setCartItems] = useState({});
  const [obs, setObs] = useState("");
  const [serviceCharge, setServiceCharge] = useState(true);
  const [payMethod, setPayMethod] = useState("Cartão");
  const [busy, setBusy] = useState(false);

  const tablesCount = store.settings?.tablesCount || 10;

  // Indexação O(n) para evitar O(n*m) — usa util centralizado
  const byMesa = buildMesaIndex(store.orders);

  const tables = Array.from({ length: tablesCount }, (_, i) => {
    const num = String(i + 1).padStart(2, "0");
    const name = `Mesa ${num}`;
    const numInt = parseInt(num, 10);
    // Busca direta no índice — evita filtro em todas as mesas
    let activeOrders = byMesa.get(numInt) || [];

    // Fallback extra para casos sem tableNumber (legado): verifica exato
    if (activeOrders.length === 0) {
      activeOrders = store.orders.filter((o) => {
        if (["ENTREGUE", "CANCELADO"].includes(o.status)) return false;
        const addr = (o.customer?.addr || "").trim();
        const cname = (o.customer?.name || "").trim();
        if (addr === name) return true;
        if (cname === name) return true;
        if (cname.startsWith(name + " ·") || cname.startsWith(name + " -") || cname.startsWith(name + " ")) return true;
        return false;
      });
    }

    const primaryOrder = activeOrders[0] || null;
    const allItems = activeOrders.flatMap((o) => o.items || []);
    const tableTotal = activeOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const oldest = activeOrders.reduce((min, o) => Math.min(min, o.createdAt || Date.now()), Date.now());

    return {
      num,
      name,
      orders: activeOrders,
      order: primaryOrder,
      items: allItems,
      total: tableTotal,
      occupied: activeOrders.length > 0,
      oldest,
      elapsed: activeOrders.length ? elapsed(oldest, now) : null,
    };
  });

  const occupiedCount = tables.filter((t) => t.occupied).length;
  const freeCount = tablesCount - occupiedCount;
  const totalConsumption = tables.reduce((acc, t) => acc + t.total, 0);

  const filteredTables = tables.filter((t) => {
    if (filter === "OCUPADAS") return t.occupied;
    if (filter === "LIVRES") return !t.occupied;
    return true;
  });

  const handleStartOrder = async () => {
    const items = Object.entries(cartItems)
      .filter(([_, qty]) => qty > 0)
      .map(([pid, qty]) => ({ productId: pid, qty, optionIds: [], note: "" }));

    if (items.length === 0) {
      store.toast("Selecione pelo menos 1 produto para abrir a comanda.");
      return;
    }

    // Validação extra: não abrir mesa já ocupada (race condition)
    const numInt = parseInt(openModal.tableNum, 10);
    const already = store.orders.filter((o) => {
      if (["ENTREGUE", "CANCELADO"].includes(o.status)) return false;
      const tn = o.tableNumber ?? o.table_number;
      if (tn != null && parseInt(tn, 10) === numInt) return true;
      return false;
    });
    if (already.length > 0) {
      store.toast(`⚠️ ${openModal.tableName} já está ocupada! Use Nova Rodada.`);
      setBusy(false);
      return;
    }

    setBusy(true);
    try {
      const body = {
        customer: {
          name: custName.trim() ? `${openModal.tableName} · ${custName.trim()}` : openModal.tableName,
          phone: "(81) 90000-0000",
          addr: openModal.tableName,
        },
        items,
        type: "dine_in",
        payment: "No fechamento da mesa",
        note: obs.trim(),
        tableNumber: numInt,
        tableName: openModal.tableName,
      };
      await api("/api/orders", { method: "POST", body });
      store.toast(`🎉 ${openModal.tableName} aberta! Comanda enviada para a cozinha.`);
      setOpenModal(null);
      setCartItems({});
      setCustName("");
      setObs("");
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const handleAppendItems = async () => {
    if (!addItemModal?.order) return;
    const items = Object.entries(cartItems)
      .filter(([_, qty]) => qty > 0)
      .map(([pid, qty]) => ({ productId: pid, qty, optionIds: [], note: obs.trim() }));

    if (items.length === 0) {
      store.toast("Selecione pelo menos 1 produto para a nova rodada.");
      return;
    }

    setBusy(true);
    try {
      await api(`/api/orders/${addItemModal.order.id}/items`, {
        method: "POST",
        body: { items },
      });
      store.toast(`🔥 Nova rodada enviada para a cozinha na ${addItemModal.name}!`);
      setAddItemModal(null);
      setCartItems({});
      setObs("");
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const handleTransferTable = async () => {
    if (!transferModal?.order || !targetTable) return;
    // Avisa se destino já ocupada (permite mesclar, mas avisa)
    const targetNum = parseInt((targetTable.match(/\d+/) || ["0"])[0], 10);
    const targetOccupied = tables.find((t) => parseInt(t.num, 10) === targetNum)?.occupied;
    if (targetOccupied) {
      const ok = confirm(`A ${targetTable} já está ocupada. Deseja mesclar as comandas? (os consumos serão somados)`);
      if (!ok) return;
    }
    setBusy(true);
    try {
      for (const ord of transferModal.orders) {
        await api(`/api/orders/${ord.id}/table`, {
          method: "PATCH",
          body: { table: targetTable },
        });
      }
      store.toast(`🔄 Comanda transferida para a ${targetTable}!`);
      setTransferModal(null);
      setTargetTable("");
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const handleCloseTable = async () => {
    if (!closeModal?.orders?.length) return;
    setBusy(true);
    try {
      for (const ord of closeModal.orders) {
        await api(`/api/orders/${ord.id}/status`, {
          method: "PATCH",
          body: { status: "ENTREGUE", payment: payMethod },
        });
      }
      store.toast(`✅ ${closeModal.name} fechada e liberada com sucesso! (${payMethod})`);
      setCloseModal(null);
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const printTableBill = (t) => {
    if (!t.occupied) return;
    const items = t.items;
    const subtotal = t.total;
    const serv = serviceCharge ? subtotal * 0.1 : 0;
    const totalFinal = subtotal + serv;
    const codes = t.orders.map((o) => `#${o.code}`).join(", ");
    const oldest = t.orders.reduce((min, o) => Math.min(min, o.createdAt), Date.now());

    const itemsHtml = items.map((i) => `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>${i.qty}x ${i.name}</span>
        <span>${brl(i.unit * i.qty)}</span>
      </div>
    `).join("");

    printHTML(`
      <div style="font-family:sans-serif; padding:12px; max-width:280px; margin:0 auto; font-size:12px;">
        <h2 style="text-align:center; margin:0 0 4px;">TÔ NO SARRO!</h2>
        <div style="text-align:center; font-size:10px; color:#666; margin-bottom:8px;">PRÉ-CONTA · CONFERÊNCIA DE MESA</div>
        <div style="border-top:1px dashed #ccc; border-bottom:1px dashed #ccc; padding:6px 0; margin-bottom:8px;">
          <strong>${t.name}</strong> · Comanda ${codes}<br/>
          <span style="font-size:10px; color:#555;">Permanência: ${elapsed(oldest, now)}</span>
        </div>
        <div style="margin-bottom:8px;">
          ${itemsHtml}
        </div>
        <div style="border-top:1px dashed #ccc; padding-top:6px;">
          <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>${brl(subtotal)}</span></div>
          ${serviceCharge ? `<div style="display:flex; justify-content:space-between; color:#555;"><span>Serviço (10%):</span><span>${brl(serv)}</span></div>` : ""}
          <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:14px; margin-top:4px;">
            <span>TOTAL:</span><span>${brl(totalFinal)}</span>
          </div>
        </div>
        <div style="text-align:center; font-size:9px; color:#888; margin-top:12px;">Não é documento fiscal · Agradecemos a preferência!</div>
      </div>
    `);
  };

  const printTableQRCodes = async () => {
    setBusy(true);
    try {
      const baseUrl = window.location.origin;
      const cards = await Promise.all(
        tables.map(async (t) => {
          const url = `${baseUrl}/?mesa=${t.num}`;
          const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
          return `
            <div style="border: 2px dashed #000; border-radius: 14px; padding: 18px 14px; text-align: center; background: #fff; width: 44%; margin: 2% 2%; box-sizing: border-box; page-break-inside: avoid; display: inline-block; vertical-align: top;">
              <div style="font-size: 16px; font-weight: 900; color: #f58200; margin-bottom: 2px;">🍔 TÔ NO SARRO!</div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 8px;">Burgers Artesanais</div>
              <div style="background: #000; color: #fff; font-size: 22px; font-weight: 900; padding: 4px 16px; border-radius: 8px; margin-bottom: 10px; display: inline-block;">
                ${t.name}
              </div>
              <div style="margin: 0 auto 10px;">
                <img src="${qr}" width="150" height="150" style="display: block; margin: 0 auto;" />
              </div>
              <div style="font-size: 12.5px; font-weight: 900; color: #000; margin-bottom: 3px;">CARDÁPIO DIGITAL</div>
              <div style="font-size: 10px; color: #555; line-height: 1.3;">
                Aponte a câmera do celular para ver o cardápio e pedir direto na mesa!
              </div>
            </div>
          `;
        })
      );

      printHTML(`
        <div style="font-family: sans-serif; padding: 10px; text-align: center;">
          <div style="margin-bottom: 14px; font-size: 12px; color: #555;">
            <strong>Plaquinhas de Mesa Tô no Sarro!</strong> — Imprima em folha A4, recorte nas linhas pontilhadas e coloque nos displays acrílicos.
          </div>
          ${cards.join("")}
        </div>
      `);
    } catch (e) {
      store.toast("Erro ao gerar plaquinhas: " + e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon="🍽️" label="Total de Mesas" value={tablesCount} />
        <KPI icon="🟢" label="Mesas Livres" value={freeCount} accent={C.green} />
        <KPI icon="🟡" label="Mesas Ocupadas" value={occupiedCount} accent={C.yellowLight} />
        <KPI icon="💰" label="Consumo no Salão" value={brl(totalConsumption)} accent={C.orange} />
      </div>

      {/* BARRA DE FILTROS E AÇÕES */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {["TODAS", "LIVRES", "OCUPADAS"].map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="rounded-lg px-3 py-1.5 font-bold text-xs transition"
              style={{
                background: filter === k ? C.orange : C.gray850,
                color: filter === k ? C.black : "#8a8a8a",
                border: `1px solid ${filter === k ? C.orange : C.gray800}`,
              }}
            >
              {k === "TODAS" ? `Todas (${tablesCount})` : k === "LIVRES" ? `Livres (${freeCount})` : `Ocupadas (${occupiedCount})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setQrAllModal(true)}
            className="rounded-lg px-3 py-1.5 font-bold text-xs transition flex items-center gap-1.5 text-white active:scale-95"
            style={{ background: C.gray800, border: `1px solid ${C.gray700}` }}
          >
            <span>📲</span>
            <span>Plaquinhas QR Code</span>
          </button>
        </div>
      </div>

      {/* GRADE DE MESAS */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredTables.map((t) => (
          <Card
            key={t.num}
            className="p-4 flex flex-col justify-between transition"
            style={{
              borderColor: t.occupied ? `${C.orange}66` : C.gray800,
              background: t.occupied ? `linear-gradient(135deg, ${C.gray900}, ${C.black})` : C.gray900,
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 20 }}>
                  {t.name}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 font-bold text-xs"
                  style={{
                    background: t.occupied ? "#854d0e33" : "#16653433",
                    color: t.occupied ? C.yellowLight : C.green,
                    border: `1px solid ${t.occupied ? C.yellow : C.green}44`,
                  }}
                >
                  {t.occupied ? `Ocupada (${t.orders.length} ${t.orders.length > 1 ? "pedidos" : "pedido"})` : "Livre"}
                </span>
              </div>

              {t.occupied ? (
                <div className="space-y-2 mt-3 text-xs">
                  <div className="flex justify-between" style={{ color: "#8a8a8a" }}>
                    <span>Permanência:</span>
                    <span style={{ color: C.white, fontWeight: 700 }}>⏱ {t.elapsed || elapsed(t.oldest, now)}</span>
                  </div>
                  <div className="flex justify-between" style={{ color: "#8a8a8a" }}>
                    <span>Cozinha (KDS):</span>
                    <span style={{ color: C.orange, fontWeight: 800 }}>{t.order?.status || t.orders[0]?.status}</span>
                  </div>
                  <div className="flex justify-between" style={{ color: "#8a8a8a" }}>
                    <span>Comandas:</span>
                    <span style={{ color: "#c9c9c9", fontWeight: 700 }}>{t.orders.length} {t.orders.length>1?"pedidos":"pedido"} · {t.items.length} itens</span>
                  </div>

                  <div className="p-2 rounded-lg space-y-1 mt-2" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
                    <div style={{ color: "#7a7a7a", fontSize: 10, fontWeight: 700 }}>ITENS CONSUMIDOS:</div>
                    {t.items.slice(0, 4).map((it, idx) => (
                      <div key={idx} className="flex justify-between text-white" style={{ fontSize: 11.5 }}>
                        <span className="truncate max-w-[70%]">{it.qty}x {it.name}</span>
                        <span style={{ color: C.yellowLight }}>{brl(it.unit * it.qty)}</span>
                      </div>
                    ))}
                    {t.items.length > 4 && (
                      <div style={{ color: "#7a7a7a", fontSize: 10 }}>+ {t.items.length - 4} outros itens...</div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2 font-black text-sm" style={{ borderTop: `1px solid ${C.gray800}` }}>
                    <span style={{ color: "#8a8a8a" }}>TOTAL:</span>
                    <span style={{ color: C.yellowLight, fontSize: 16 }}>{brl(t.total)}</span>
                  </div>
                </div>
              ) : (
                <div className="py-5 text-center">
                  <div style={{ fontSize: 32, opacity: 0.35 }}>🍽️</div>
                  <div style={{ color: "#777", fontSize: 11, marginTop: 4 }}>Mesa livre para atendimento</div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-2">
              {t.occupied ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => { setAddItemModal(t); setCartItems({}); setObs(""); }}
                      className="rounded-lg py-1.5 font-bold text-xs transition active:scale-95"
                      style={{ background: `${C.orange}22`, color: C.orange, border: `1px solid ${C.orange}66` }}
                    >
                      ➕ Nova Rodada
                    </button>
                    <button
                      onClick={() => { setTransferModal(t); setTargetTable(""); }}
                      className="rounded-lg py-1.5 font-bold text-xs transition active:scale-95"
                      style={{ background: C.gray850, color: "#ccc", border: `1px solid ${C.gray700}` }}
                    >
                      ↔️ Trocar Mesa
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => printTableBill(t)}
                      className="rounded-lg py-1.5 font-bold text-xs transition active:scale-95"
                      style={{ background: C.gray800, color: C.white, border: `1px solid ${C.gray700}` }}
                    >
                      🖨️ Pré-Conta
                    </button>
                    <button
                      onClick={() => setCloseModal(t)}
                      className="rounded-lg py-1.5 font-bold text-xs transition active:scale-95 text-black"
                      style={{ background: C.green }}
                    >
                      💵 Fechar Mesa
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => { setOpenModal({ tableNum: t.num, tableName: t.name }); setCartItems({}); setCustName(""); setObs(""); }}
                    className="col-span-2 rounded-lg py-2.5 font-bold text-xs transition active:scale-95 text-black"
                    style={{ background: `linear-gradient(100deg, ${C.orange}, ${C.yellow})` }}
                  >
                    + Abrir Mesa
                  </button>
                  <button
                    onClick={() => setQrSingle(t)}
                    className="rounded-lg py-2.5 font-bold text-xs transition active:scale-95 text-white"
                    style={{ background: C.gray800, border: `1px solid ${C.gray700}` }}
                    title="Ver QR Code desta mesa"
                  >
                    📲 QR
                  </button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* MODAL 1: ABRIR MESA (PRIMEIRA COMANDA) */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
          <Card className="w-full max-w-lg p-5 space-y-3.5 max-h-[92vh] overflow-y-auto" style={{ border: `1px solid ${C.orange}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 22 }}>
                🍽️ ABRIR COMANDA — {openModal.tableName}
              </div>
              <button onClick={() => setOpenModal(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label style={{ color: "#8a8a8a" }}>Identificação do Cliente (opcional)</label>
                <input
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="ex.: João e amigos"
                  className="w-full rounded-lg px-2.5 py-1.5 mt-1 outline-none text-white"
                  style={{ background: C.black, border: `1px solid ${C.gray800}` }}
                />
              </div>
              <div>
                <label style={{ color: "#8a8a8a" }}>Observação para Cozinha</label>
                <input
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="ex.: Sem cebola, gelo à parte"
                  className="w-full rounded-lg px-2.5 py-1.5 mt-1 outline-none text-white"
                  style={{ background: C.black, border: `1px solid ${C.gray800}` }}
                />
              </div>
            </div>

            {/* SELEÇÃO DE PRODUTOS */}
            <div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
                Selecione os itens do primeiro pedido:
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {store.products.map((p) => {
                  const qty = cartItems[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg text-xs"
                      style={{ background: C.black, border: `1px solid ${qty > 0 ? C.orange : C.gray850}` }}
                    >
                      <div className="flex items-center gap-2 truncate max-w-[65%]">
                        <span style={{ fontSize: 16 }}>{p.emoji || "🍔"}</span>
                        <div>
                          <div className="text-white font-bold truncate">{p.name}</div>
                          <div style={{ color: C.yellowLight }}>{brl(p.price)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {qty > 0 && (
                          <button
                            onClick={() => setCartItems((prev) => ({ ...prev, [p.id]: Math.max(0, qty - 1) }))}
                            className="w-6 h-6 rounded flex items-center justify-center font-bold"
                            style={{ background: C.gray800, color: C.white }}
                          >
                            −
                          </button>
                        )}
                        {qty > 0 && <span className="font-bold text-white px-1">{qty}</span>}
                        <button
                          onClick={() => setCartItems((prev) => ({ ...prev, [p.id]: qty + 1 }))}
                          className="w-6 h-6 rounded flex items-center justify-center font-bold text-black"
                          style={{ background: C.orange }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TOTAL DO PEDIDO */}
            <div className="p-3 rounded-xl flex items-center justify-between" style={{ background: C.gray850 }}>
              <span style={{ color: "#8a8a8a", fontSize: 12 }}>Total da comanda inicial:</span>
              <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 16 }}>
                {brl(
                  Object.entries(cartItems).reduce((sum, [pid, qty]) => {
                    const pr = store.products.find((p) => p.id === pid);
                    return sum + (pr ? pr.price * qty : 0);
                  }, 0)
                )}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <Btn full variant="dark" onClick={() => setOpenModal(null)}>Cancelar</Btn>
              <Btn full disabled={busy} onClick={handleStartOrder}>
                {busy ? "Abrindo…" : "🔥 Abrir Mesa & Enviar à Cozinha"}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 2: NOVA RODADA (+ ADICIONAR ITENS À COMANDA EXISTENTE) */}
      {addItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
          <Card className="w-full max-w-lg p-5 space-y-3.5 max-h-[92vh] overflow-y-auto" style={{ border: `1px solid ${C.orange}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 22 }}>
                  ➕ NOVA RODADA — {addItemModal.name}
                </div>
                <div style={{ color: "#8a8a8a", fontSize: 11 }}>
                  Os itens serão somados à comanda atual e enviados direto para a cozinha/KDS.
                </div>
              </div>
              <button onClick={() => setAddItemModal(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div>
              <label style={{ color: "#8a8a8a", fontSize: 11.5 }}>Observação da nova rodada (opcional)</label>
              <input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="ex.: Bebida com gelo e limão, porção com molho à parte"
                className="w-full rounded-lg px-2.5 py-1.5 mt-1 outline-none text-white text-xs"
                style={{ background: C.black, border: `1px solid ${C.gray800}` }}
              />
            </div>

            <div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
                Escolha os produtos para a nova rodada:
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {store.products.map((p) => {
                  const qty = cartItems[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg text-xs"
                      style={{ background: C.black, border: `1px solid ${qty > 0 ? C.orange : C.gray850}` }}
                    >
                      <div className="flex items-center gap-2 truncate max-w-[65%]">
                        <span style={{ fontSize: 16 }}>{p.emoji || "🍔"}</span>
                        <div>
                          <div className="text-white font-bold truncate">{p.name}</div>
                          <div style={{ color: C.yellowLight }}>{brl(p.price)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {qty > 0 && (
                          <button
                            onClick={() => setCartItems((prev) => ({ ...prev, [p.id]: Math.max(0, qty - 1) }))}
                            className="w-6 h-6 rounded flex items-center justify-center font-bold"
                            style={{ background: C.gray800, color: C.white }}
                          >
                            −
                          </button>
                        )}
                        {qty > 0 && <span className="font-bold text-white px-1">{qty}</span>}
                        <button
                          onClick={() => setCartItems((prev) => ({ ...prev, [p.id]: qty + 1 }))}
                          className="w-6 h-6 rounded flex items-center justify-center font-bold text-black"
                          style={{ background: C.orange }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-xl flex items-center justify-between" style={{ background: C.gray850 }}>
              <span style={{ color: "#8a8a8a", fontSize: 12 }}>Valor desta nova rodada:</span>
              <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 16 }}>
                {brl(
                  Object.entries(cartItems).reduce((sum, [pid, qty]) => {
                    const pr = store.products.find((p) => p.id === pid);
                    return sum + (pr ? pr.price * qty : 0);
                  }, 0)
                )}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <Btn full variant="dark" onClick={() => setAddItemModal(null)}>Cancelar</Btn>
              <Btn full disabled={busy} onClick={handleAppendItems}>
                {busy ? "Enviando…" : "🔥 Confirmar & Enviar à Cozinha"}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 3: TROCAR / TRANSFERIR MESA */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
          <Card className="w-full max-w-md p-5 space-y-4" style={{ border: `1px solid ${C.orange}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 20 }}>
                ↔️ TRANSFERIR — {transferModal.name}
              </div>
              <button onClick={() => setTransferModal(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <p style={{ color: "#8a8a8a", fontSize: 12.5 }}>
              Transfira a comanda e o consumo atual da <strong>{transferModal.name}</strong> para outra mesa livre do salão.
            </p>

            <div>
              <label style={{ color: C.white, fontWeight: 700, fontSize: 12 }}>Selecione a mesa de destino:</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {tables
                  .filter((t) => !t.occupied && t.name !== transferModal.name)
                  .map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setTargetTable(t.name)}
                      className="rounded-lg p-2.5 text-center font-bold text-xs transition"
                      style={{
                        background: targetTable === t.name ? C.orange : C.gray850,
                        color: targetTable === t.name ? C.black : C.white,
                        border: `1px solid ${targetTable === t.name ? C.orange : C.gray700}`,
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
              </div>
              {tables.filter((t) => !t.occupied && t.name !== transferModal.name).length === 0 && (
                <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 8 }}>
                  Todas as outras mesas estão ocupadas no momento.
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Btn full variant="dark" onClick={() => setTransferModal(null)}>Cancelar</Btn>
              <Btn full disabled={busy || !targetTable} onClick={handleTransferTable}>
                {busy ? "Transferindo…" : `Transferir para ${targetTable || "..."}`}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 4: QR CODE INDIVIDUAL DE UMA MESA */}
      {qrSingle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
          <Card className="w-full max-w-sm p-5 space-y-4 text-center" style={{ border: `1px solid ${C.orange}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 22 }}>
                📲 QR CODE — {qrSingle.name}
              </div>
              <button onClick={() => setQrSingle(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-4 bg-white rounded-xl inline-block mx-auto shadow-lg">
              <QRCodeImage value={`${window.location.origin}/?mesa=${qrSingle.num}`} size={180} />
            </div>

            <div style={{ color: "#8a8a8a", fontSize: 12 }}>
              Link de acesso direto da mesa:<br />
              <span style={{ color: C.yellowLight, fontWeight: 700 }}>
                {window.location.origin}/?mesa={qrSingle.num}
              </span>
            </div>

            <div className="flex gap-2">
              <Btn
                full
                variant="dark"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?mesa=${qrSingle.num}`);
                  store.toast("📋 Link da mesa copiado!");
                }}
              >
                📋 Copiar Link
              </Btn>
              <Btn
                full
                onClick={() => {
                  window.open(`/?mesa=${qrSingle.num}`, "_blank");
                }}
              >
                👀 Testar Mesa
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 5: TODAS AS PLAQUINHAS QR CODE */}
      {qrAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.85)" }}>
          <Card className="w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={{ border: `1px solid ${C.orange}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 22 }}>
                  📲 PLAQUINHAS QR CODE DO SALÃO
                </div>
                <div style={{ color: "#8a8a8a", fontSize: 11.5 }}>
                  Imprima as plaquinhas para colocar nas mesas dos clientes.
                </div>
              </div>
              <button onClick={() => setQrAllModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
              {tables.map((t) => (
                <div key={t.num} className="p-3 rounded-xl bg-black border border-gray-800 text-center space-y-2">
                  <div className="font-extrabold text-white text-sm">{t.name}</div>
                  <div className="bg-white p-2 rounded-lg inline-block">
                    <QRCodeImage value={`${window.location.origin}/?mesa=${t.num}`} size={110} />
                  </div>
                  <div style={{ color: "#777", fontSize: 9.5 }}>/?mesa={t.num}</div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex gap-2">
              <Btn full variant="dark" onClick={() => setQrAllModal(false)}>Fechar</Btn>
              <Btn full disabled={busy} onClick={printTableQRCodes}>
                {busy ? "Gerando…" : "🖨️ Imprimir Todas as Plaquinhas (A4)"}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 6: FECHAR MESA & PAGAMENTO */}
      {closeModal && closeModal.occupied && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
          <Card className="w-full max-w-md p-5 space-y-4" style={{ border: `2px solid ${C.green}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 22 }}>
                💵 FECHAR CONTA — {closeModal.name}
              </div>
              <button onClick={() => setCloseModal(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-3.5 rounded-xl space-y-2 text-xs" style={{ background: C.gray850 }}>
              <div className="flex justify-between" style={{ color: "#8a8a8a" }}>
                <span>Comanda:</span>
                <span style={{ color: C.white, fontWeight: 700 }}>
                  {closeModal.orders.map((o) => `#${o.code}`).join(", ")}
                </span>
              </div>
              <div className="flex justify-between" style={{ color: "#8a8a8a" }}>
                <span>Tempo no salão:</span>
                <span style={{ color: C.white }}>⏱ {elapsed(closeModal.order?.createdAt, now)}</span>
              </div>

              <div className="pt-2 pb-1 border-t border-gray-800 space-y-1">
                {closeModal.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-white">
                    <span>{it.qty}x {it.name}</span>
                    <span style={{ color: C.yellowLight }}>{brl(it.unit * it.qty)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-800 flex justify-between">
                <span style={{ color: "#8a8a8a" }}>Subtotal:</span>
                <span style={{ color: C.white, fontWeight: 700 }}>{brl(closeModal.total)}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: "#aaa" }}>
                  <input
                    type="checkbox"
                    checked={serviceCharge}
                    onChange={(e) => setServiceCharge(e.target.checked)}
                    className="accent-orange-500"
                  />
                  <span>Taxa de serviço 10% (opcional)</span>
                </label>
                <span style={{ color: serviceCharge ? C.green : "#555" }}>
                  {brl(serviceCharge ? closeModal.total * 0.1 : 0)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-800 font-black text-sm">
                <span style={{ color: C.white }}>TOTAL A COBRAR:</span>
                <span style={{ color: C.yellowLight, fontSize: 18 }}>
                  {brl(closeModal.total + (serviceCharge ? closeModal.total * 0.1 : 0))}
                </span>
              </div>
            </div>

            {/* SELEÇÃO DE PAGAMENTO */}
            <div>
              <div style={{ color: "#8a8a8a", fontSize: 11, marginBottom: 6 }}>Forma de pagamento utilizada:</div>
              <div className="grid grid-cols-3 gap-1.5">
                {["PIX", "Cartão", "Dinheiro"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className="rounded-lg py-2 font-bold text-xs transition"
                    style={{
                      background: payMethod === m ? `${C.orange}22` : C.gray850,
                      border: `1px solid ${payMethod === m ? C.orange : C.gray800}`,
                      color: payMethod === m ? C.orange : "#8a8a8a",
                    }}
                  >
                    {m === "PIX" ? "⚡ Pix" : m === "Cartão" ? "💳 Cartão" : "💵 Dinheiro"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleCloseTable}
                disabled={busy}
                className="w-full rounded-xl py-3.5 font-black text-black transition active:scale-95"
                style={{ background: C.green, fontSize: 14 }}
              >
                {busy ? "Finalizando…" : "✅ Confirmar Pagamento & Liberar Mesa"}
              </button>

              <button
                onClick={() => printTableBill(closeModal)}
                className="w-full rounded-xl py-2 font-bold text-xs"
                style={{ background: C.gray800, color: C.white, border: `1px solid ${C.gray700}` }}
              >
                🖨️ Imprimir Pré-Conta
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

}
