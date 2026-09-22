// ============================================================
// HISTÓRICO DE ACERTOS DE ENTREGADORES
//
// Extraído do App.jsx monolítico junto do modal de acerto, para o
// admin conseguir conferir os fechamentos já feitos.
// ============================================================

import React, { useState, useEffect } from "react";
import { C, font } from "../../constants/theme.js";
import { brl } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printDriverSettlementReceipt } from "../../utils/print.js";
import { Card } from "../ui/index.jsx";

function SettlementsHistoryModal({ store, onClose }) {
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await api("/api/settlements?limit=30");
        if (mounted) setSettlements(data.settlements || (Array.isArray(data) ? data : []));
      } catch (err) {
        store.toast("Erro ao carregar histórico de acertos");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ background: "rgba(0,0,0,.82)" }}>
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden" style={{ border: `1px solid ${C.orange}66`, background: C.gray900 }}>
        <div className="p-4 flex items-center justify-between" style={{ background: C.gray850, borderBottom: `1px solid ${C.gray800}` }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white }}>
              HISTÓRICO DE ACERTOS DE ENTREGADORES
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold px-2">✕</button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Carregando acertos...</div>
          ) : settlements.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nenhum acerto registrado ainda.</div>
          ) : (
            settlements.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl space-y-2 text-xs"
                style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>{s.driver_name}</span>
                    <span style={{ color: "#7a7a7a", marginLeft: 8 }}>
                      {new Date(s.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <button
                    onClick={() => printDriverSettlementReceipt(s, store.settings)}
                    className="px-2.5 py-1 rounded-lg font-bold text-xs text-white flex items-center gap-1 active:scale-95"
                    style={{ background: C.gray800, border: `1px solid ${C.gray700}` }}
                  >
                    <span>🖨</span>
                    <span>2ª Via</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-1.5 rounded" style={{ background: C.gray900 }}>
                    <div style={{ color: "#7a7a7a", fontSize: 9 }}>ENTREGAS</div>
                    <div style={{ color: C.white, fontWeight: 800 }}>{s.deliveries_count}</div>
                  </div>
                  <div className="p-1.5 rounded" style={{ background: C.gray900 }}>
                    <div style={{ color: "#7a7a7a", fontSize: 9 }}>TAXAS MOTOBY</div>
                    <div style={{ color: C.green, fontWeight: 800 }}>{brl(s.total_fees)}</div>
                  </div>
                  <div className="p-1.5 rounded" style={{ background: C.gray900 }}>
                    <div style={{ color: "#7a7a7a", fontSize: 9 }}>DINHEIRO RECOLHIDO</div>
                    <div style={{ color: C.yellowLight, fontWeight: 800 }}>{brl(s.total_cash_collected)}</div>
                  </div>
                  <div className="p-1.5 rounded" style={{ background: C.gray900 }}>
                    <div style={{ color: "#7a7a7a", fontSize: 9 }}>SALDO FINAL</div>
                    <div style={{ color: s.net_balance >= 0 ? C.green : "#38bdf8", fontWeight: 800 }}>
                      {s.net_balance >= 0 ? `+${brl(s.net_balance)}` : brl(s.net_balance)}
                    </div>
                  </div>
                </div>
                {s.notes && (
                  <div style={{ color: "#8a8a8a", fontSize: 11, fontStyle: "italic" }}>
                    Obs: {s.notes} · Fechado por {s.settled_by}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-gray-850 flex justify-end" style={{ borderTop: `1px solid ${C.gray800}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-gray-800 hover:bg-gray-700">
            Fechar
          </button>
        </div>
      </Card>
    </div>
  );
}

export default SettlementsHistoryModal;
