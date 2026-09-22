// ============================================================
// ACERTO DO ENTREGADOR (fechamento de turno)
//
// Nasceu no App.jsx monolítico e foi movido para cá para que a
// área do entregador (/entregador) e o admin (/admin > Entregadores)
// usem o MESMO modal. O entregador abre em modo leitura (readOnly):
// quem fecha o acerto é a loja (POST /api/drivers/:id/settle).
// ============================================================

import React, { useState, useEffect } from "react";
import { C, font } from "../../constants/theme.js";
import { brl } from "../../utils/format.js";
import { printDriverSettlementReceipt } from "../../utils/print.js";
import { Card } from "../ui/index.jsx";

function DriverSettlementModal({ driver, store, onClose, readOnly = false }) {
  const [loading, setLoading] = useState(true);
  const [settlementData, setSettlementData] = useState(null);
  const [basePay, setBasePay] = useState(0);
  const [notes, setNotes] = useState("");
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await store.getDriverSettlement(driver.id);
        if (mounted) setSettlementData(data);
      } catch (err) {
        store.toast(err.message || "Erro ao carregar acerto do entregador");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [driver.id]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
        <Card className="p-8 text-center" style={{ background: C.gray900 }}>
          <div className="animate-spin text-3xl mb-2">🔄</div>
          <div style={{ color: C.white, fontWeight: 700 }}>Calculando acerto de {driver.name}...</div>
        </Card>
      </div>
    );
  }

  const orders = settlementData?.orders || [];
  const s = settlementData?.summary || {};
  const totalOrders = orders.length;
  const totalFees = s.totalFees || 0;
  const cashCollected = s.totalCashCollected || 0;
  const numBasePay = Math.max(0, parseFloat(basePay) || 0);
  const totalToDriver = totalFees + numBasePay;
  const netDiff = Math.round((cashCollected - totalToDriver) * 100) / 100;

  const currentPreviewSettlement = {
    createdAt: Date.now(),
    settledBy: store.me?.name || "Operador",
    driver,
    orders,
    summary: {
      deliveriesCount: totalOrders,
      totalFees,
      basePay: numBasePay,
      totalCashCollected: cashCollected,
      totalDueToDriver: totalToDriver,
      netBalance: netDiff,
    },
  };

  const handlePrint = () => {
    printDriverSettlementReceipt(currentPreviewSettlement, store.settings);
  };

  const handleSettle = async () => {
    if (orders.length === 0) {
      store.toast("Não há entregas pendentes para fechar com este entregador.");
      return;
    }
    const msgConfirm = netDiff > 0
      ? `Confirmar fechamento com ${driver.name}?\n${totalOrders} entregas realizadas.\nO motoboy deve DEVOLVER ${brl(netDiff)} ao caixa da loja.`
      : netDiff < 0
      ? `Confirmar fechamento com ${driver.name}?\n${totalOrders} entregas realizadas.\nA loja deve PAGAR ${brl(Math.abs(netDiff))} ao motoboy.`
      : `Confirmar fechamento com ${driver.name}?\n${totalOrders} entregas realizadas.\nSaldo zerado (contas batidas!).`;

    if (!confirm(msgConfirm)) return;

    try {
      setSettling(true);
      const res = await store.settleDriver(driver.id, {
        basePay: numBasePay,
        notes: notes || "",
      });
      printDriverSettlementReceipt(res, store.settings);
      onClose();
    } catch (err) {
      store.toast(err.message || "Erro ao registrar fechamento");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,.82)" }}>
      <Card className="w-full max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden" style={{ border: `1px solid ${C.orange}66`, background: C.gray900 }}>
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ background: C.gray850, borderBottom: `1px solid ${C.gray800}` }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🤝</span>
              <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white }}>
                ACERTO DE ENTREGADOR
              </h3>
            </div>
            <div style={{ color: C.orange, fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              {driver.name} {driver.vehicle ? `· ${driver.vehicle}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold px-2">✕</button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Métricas do Turno */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl text-center" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700 }}>ENTREGAS</div>
              <div style={{ color: C.white, fontSize: 18, fontWeight: 900 }}>{totalOrders}</div>
            </div>
            <div className="p-2.5 rounded-xl text-center" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700 }}>TAXAS MOTOBOY</div>
              <div style={{ color: C.green, fontSize: 18, fontWeight: 900 }}>{brl(totalFees)}</div>
            </div>
            <div className="p-2.5 rounded-xl text-center" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700 }}>DINHEIRO RECOLHIDO</div>
              <div style={{ color: C.yellowLight, fontSize: 18, fontWeight: 900 }}>{brl(cashCollected)}</div>
            </div>
            <div className="p-2.5 rounded-xl text-center" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700 }}>TOTAL CORRIDAS</div>
              <div style={{ color: "#38bdf8", fontSize: 18, fontWeight: 900 }}>
                {brl(orders.reduce((sum, o) => sum + (o.total || 0), 0))}
              </div>
            </div>
          </div>

          {/* Ajuste de Remuneração Base / Diária */}
          <div className="p-3.5 rounded-xl space-y-3" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>⚙️ Parâmetros do Fechamento</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label style={{ color: "#a0a0a0", fontSize: 11, fontWeight: 700 }} className="block mb-1">
                  Diária Fixa / Ajuda de Custo (R$)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={basePay}
                  disabled={readOnly}
                  onChange={(e) => setBasePay(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg font-bold text-sm text-white"
                  style={{ background: C.gray900, border: `1px solid ${C.gray700}` }}
                />
              </div>
              <div>
                <label style={{ color: "#a0a0a0", fontSize: 11, fontWeight: 700 }} className="block mb-1">
                  Observações / Turno
                </label>
                <input
                  type="text"
                  value={notes}
                  disabled={readOnly}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Turno almoço / chuva"
                  className="w-full px-3 py-2 rounded-lg font-normal text-sm text-white"
                  style={{ background: C.gray900, border: `1px solid ${C.gray700}` }}
                />
              </div>
            </div>
          </div>

          {/* Resumo Financeiro / Saldo Líquido */}
          <div
            className="p-4 rounded-xl space-y-2.5"
            style={{
              background: netDiff > 0 ? "#16653422" : netDiff < 0 ? "#1e3a5f33" : "#1e1e1e",
              border: `2px solid ${netDiff > 0 ? C.green : netDiff < 0 ? "#38bdf8" : C.gray700}`
            }}
          >
            <div className="flex justify-between text-xs">
              <span style={{ color: "#a0a0a0" }}>Total ganho pelo motoboy (Taxas + Diária):</span>
              <span style={{ color: C.white, fontWeight: 800 }}>{brl(totalToDriver)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "#a0a0a0" }}>Total em dinheiro recolhido dos clientes:</span>
              <span style={{ color: C.white, fontWeight: 800 }}>{brl(cashCollected)}</span>
            </div>
            <div className="pt-2 flex items-center justify-between" style={{ borderTop: `1px solid ${C.gray800}` }}>
              <div>
                <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>
                  {netDiff > 0
                    ? "💰 Motoboy Devolve ao Caixa:"
                    : netDiff < 0
                    ? "💵 Caixa Paga ao Motoboy:"
                    : "🤝 Acerto 100% Equilibrado:"}
                </div>
                <div style={{ color: "#a0a0a0", fontSize: 11 }}>
                  {netDiff > 0
                    ? "Dinheiro recebido em mãos supera o valor das taxas"
                    : netDiff < 0
                    ? "Taxas ganhas superam o dinheiro recolhido"
                    : "Nenhum repasse adicional pendente"}
                </div>
              </div>
              <div style={{ color: netDiff > 0 ? C.green : netDiff < 0 ? "#38bdf8" : C.white, fontWeight: 900, fontSize: 22 }}>
                {brl(Math.abs(netDiff))}
              </div>
            </div>
          </div>

          {/* Lista de Pedidos Entregues */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: C.white, fontWeight: 800, fontSize: 12 }}>
                Entregas Realizadas no Turno ({orders.length})
              </span>
              <span style={{ color: "#8a8a8a", fontSize: 11 }}>
                Faturamento: {brl(orders.reduce((sum, o) => sum + (o.total || 0), 0))}
              </span>
            </div>
            {orders.length === 0 ? (
              <div className="p-4 rounded-xl text-center" style={{ background: C.gray850, color: "#8a8a8a", fontSize: 12 }}>
                Nenhuma entrega pendente de acerto para este entregador.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className="p-2.5 rounded-lg flex items-center justify-between text-xs"
                    style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: C.white, fontWeight: 800 }}>#{o.code}</span>
                        <span style={{ color: "#c0c0c0" }}>{o.customer?.name}</span>
                        {o.routeId && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold" style={{ background: `${C.orange}33`, color: C.orange }}>
                            Rota #{o.routeId.slice(-4)} {o.routeSeq ? `(P${o.routeSeq})` : ""}
                          </span>
                        )}
                      </div>
                      <div style={{ color: "#8a8a8a", fontSize: 11 }}>
                        Forma: <b style={{ color: String(o.payment).toUpperCase().includes("DINHEIRO") ? C.yellowLight : "#a0a0a0" }}>{o.payment}</b> · Total: {brl(o.total)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div style={{ color: C.green, fontWeight: 800 }}>+{brl(o.fee || 0)}</div>
                      <div style={{ color: "#7a7a7a", fontSize: 10 }}>taxa entrega</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 flex flex-wrap gap-2 items-center justify-between" style={{ background: C.gray850, borderTop: `1px solid ${C.gray800}` }}>
          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 text-white active:scale-95"
            style={{ background: C.gray800, border: `1px solid ${C.gray700}` }}
          >
            <span>🖨</span>
            <span>Imprimir Extrato</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl font-bold text-xs text-gray-400 hover:text-white"
            >
              Fechar
            </button>
            {!readOnly && orders.length > 0 && (
              <button
                disabled={settling}
                onClick={handleSettle}
                className="px-4 py-2.5 rounded-xl font-black text-xs text-black active:scale-95 transition flex items-center gap-2"
                style={{ background: C.green }}
              >
                <span>{settling ? "⏳" : "🤝"}</span>
                <span>{settling ? "Registrando..." : "QUITAR & FECHAR ACERTO"}</span>
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default DriverSettlementModal;
