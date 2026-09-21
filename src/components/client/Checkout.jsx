import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";

function Checkout({ store, totals, onBack, onDone }) {
  const isTable = !!store.tableParam;
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    name: "", phone: "", cpf: "", type: isTable ? "dine_in" : "delivery",
    street: "", number: "", district: "", city: "Paulista/PE", ref: "",
    payment: isTable ? "No fechamento da mesa" : "PIX", changeFor: "", needChange: false,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const fee = (f.type === "pickup" || f.type === "dine_in") ? 0 : totals.fee;
  const total = Math.max(0, totals.subtotal + fee - totals.discount);

  const steps = ["Você", "Entrega", "Local", "Pagamento", "Confirmar"];
  const valid = {
    1: f.name.trim().length > 2 && f.phone.replace(/\D/g, "").length >= 10,
    2: true,
    3: f.type === "pickup" || f.type === "dine_in" || (f.street.trim() && f.number.trim() && f.district.trim()),
    4: f.payment !== "Dinheiro" || !f.needChange || f.changeFor.trim(),
    5: true,
  };

  const finish = () => {
    // O servidor recalcula preços, cupom, taxa e total — aqui vai só a intenção.
    onDone({
      customer: {
        name: f.type === "dine_in" ? `${store.tableParam} · ${f.name}` : f.name,
        phone: f.phone,
        addr: f.type === "dine_in" ? store.tableParam : f.type === "pickup" ? "Retirada na loja" : `${f.street}, ${f.number} — ${f.district}, ${f.city}`,
      },
      type: f.type,
      payment: f.payment,
      changeFor: f.payment === "Dinheiro" && f.needChange ? f.changeFor : undefined,
      couponCode: store.coupon?.code || undefined,
      note: f.ref,
      items: store.cart.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        optionIds: i.optionIds || [],
        note: i.note || "",
      })),
    });
  };

  return (
    <div className="px-3 sm:px-4 py-5 pb-6 max-w-[720px] mx-auto w-full overflow-x-hidden">
      <button onClick={step === 1 ? onBack : () => setStep(step - 1)} style={{ color: "#8a8a8a", fontSize: 13 }}>
        ← Voltar
      </button>

      <div className="flex gap-1.5 mt-4 mb-5">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div style={{ height: 4, borderRadius: 9, background: i < step ? C.orange : C.gray800 }} />
            <div style={{ color: i < step ? C.white : "#6a6a6a", fontSize: "clamp(8.5px, 2.4vw, 9.5px)", marginTop: 5, fontWeight: 700 }}>{s}</div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white }}>QUEM TÁ PEDINDO?</h3>
          <Field label="Nome completo" value={f.name} onChange={(v) => set("name", v)} ph="João Silva" />
          <Field label="WhatsApp" value={f.phone} onChange={(v) => set("phone", v)} ph="(81) 99999-9999" />
          <Field label="CPF na nota (opcional)" value={f.cpf} onChange={(v) => set("cpf", v)} ph="000.000.000-00" />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white, marginBottom: 6 }}>
            COMO VOCÊ QUER RECEBER?
          </h3>
          {store.tableParam && (
            <Choice
              on={f.type === "dine_in"}
              onClick={() => { set("type", "dine_in"); set("payment", "No fechamento da mesa"); }}
              icon="🍽️"
              title={`Consumo na ${store.tableParam}`}
              sub="Comanda enviada direto para a cozinha · sem taxa de entrega"
            />
          )}
          <Choice on={f.type === "delivery"} onClick={() => set("type", "delivery")} icon="🛵"
            title="Delivery" sub={`35–45 min · taxa ${brl(store.fee)}`} />
          <Choice on={f.type === "pickup"} onClick={() => set("type", "pickup")} icon="🏪"
            title="Retirar na loja" sub="Pronto em ~20 min · sem taxa" />
        </div>
      )}

      {step === 3 && (
        f.type === "dine_in" ? (
          <div>
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white }}>CONSUMO NO SALÃO</h3>
            <Card className="p-4 mt-4 space-y-2">
              <div style={{ color: C.yellowLight, fontWeight: 800, fontSize: 16 }}>🍽️ {store.tableParam || "Mesa do Salão"}</div>
              <div style={{ color: "#9a9a9a", fontSize: 12.5, lineHeight: 1.5 }}>
                Seu pedido será preparado na cozinha e entregue diretamente na sua mesa no salão.
                Não é necessário informar endereço de entrega.
              </div>
            </Card>
          </div>
        ) : f.type === "pickup" ? (
          <div>
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white }}>RETIRADA NA LOJA</h3>
            <Card className="p-4 mt-4">
              <div style={{ color: C.white, fontWeight: 800, fontSize: 14 }}>TÔ NO SARRO! Burgers & Açaí</div>
              <div style={{ color: "#9a9a9a", fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                Av. Cláudio José Gueiros Leite, 3200 — Janga, Paulista/PE<br />
                Aberto de terça a domingo, 18h às 23h30
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white }}>ONDE ENTREGAMOS?</h3>
            <Field label="Rua" value={f.street} onChange={(v) => set("street", v)} ph="Rua das Palmeiras" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número" value={f.number} onChange={(v) => set("number", v)} ph="220" />
              <Field label="Bairro" value={f.district} onChange={(v) => set("district", v)} ph="Janga" />
            </div>
            <Field label="Cidade" value={f.city} onChange={(v) => set("city", v)} ph="Paulista/PE" />
            <Field label="Ponto de referência" value={f.ref} onChange={(v) => set("ref", v)} ph="Portão preto, ao lado da padaria" />
          </div>
        )
      )}

      {step === 4 && (
        <div className="space-y-3">
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white, marginBottom: 6 }}>
            COMO VAI PAGAR?
          </h3>
          {f.type === "dine_in" && (
            <Choice
              on={f.payment === "No fechamento da mesa"}
              onClick={() => set("payment", "No fechamento da mesa")}
              icon="🍽️"
              title="No fechamento da mesa"
              sub="Acerto com o garçom/caixa ao encerrar a conta"
            />
          )}
          <Choice on={f.payment === "PIX"} onClick={() => set("payment", "PIX")} icon="⚡" title="Pix" sub="Aprovação na hora · checkout seguro InfinitePay" />
          <Choice on={f.payment === "CARTAO_ONLINE"} onClick={() => set("payment", "CARTAO_ONLINE")} icon="💳" title="Cartão online" sub="Crédito em até 12x · link seguro InfinitePay" />
          <Choice on={f.payment === "Cartão"} onClick={() => set("payment", "Cartão")} icon="💳" title={f.type === "dine_in" ? "Cartão na mesa" : "Cartão na entrega"} sub="Maquininha com a equipe" />
          <Choice on={f.payment === "Dinheiro"} onClick={() => set("payment", "Dinheiro")} icon="💵" title="Dinheiro" sub="Pagamento em cédulas" />

          {f.payment === "CARTAO_ONLINE" && (
            <Card className="p-4">
              <div style={{ color: "#9a9a9a", fontSize: 12, lineHeight: 1.5 }}>
                Você recebe um <strong style={{ color: C.yellowLight }}>link seguro da InfinitePay</strong> ♾️ para pagar com
                crédito em até 12x. Nenhum dado de cartão passa pelo nosso sistema.
              </div>
            </Card>
          )}

          {f.payment === "Dinheiro" && (
            <Card className="p-4 space-y-3">
              <div style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>Precisa de troco?</div>
              <div className="flex gap-2">
                <Btn small variant={f.needChange ? "primary" : "dark"} onClick={() => set("needChange", true)}>Sim</Btn>
                <Btn small variant={!f.needChange ? "primary" : "dark"} onClick={() => set("needChange", false)}>Não precisa</Btn>
              </div>
              {f.needChange && <Field label="Troco para quanto?" value={f.changeFor} onChange={(v) => set("changeFor", v)} ph="R$ 100,00" />}
            </Card>
          )}

          {f.payment === "PIX" && (
            <Card className="p-4">
              <div style={{ color: "#9a9a9a", fontSize: 12, lineHeight: 1.5 }}>
                Ao confirmar, a gente te leva para o <strong style={{ color: C.yellowLight }}>checkout seguro da InfinitePay</strong> ♾️
                com o QR Code do Pix. A confirmação é automática — quando cair, seu pedido entra na cozinha na hora.
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 5 && (
        <div>
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white }}>CONFIRA TUDO</h3>
          <Card className="p-4 mt-4 space-y-2">
            {store.cart.map((i) => (
              <div key={i.id} className="flex justify-between" style={{ color: "#d0d0d0", fontSize: 13 }}>
                <span>{i.qty}x {i.name}</span><span>{brl(i.unit * i.qty)}</span>
              </div>
            ))}
            <div className="pt-2 space-y-1" style={{ borderTop: `1px solid ${C.gray800}` }}>
              <div className="flex justify-between" style={{ color: "#9a9a9a", fontSize: 12.5 }}>
                <span>Entrega</span><span>{fee === 0 ? "Grátis" : brl(fee)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between" style={{ color: C.green, fontSize: 12.5 }}>
                  <span>Desconto</span><span>−{brl(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span style={{ color: C.white, fontWeight: 900 }}>Total</span>
                <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 18 }}>{brl(total)}</span>
              </div>
            </div>
          </Card>
          <Card className="p-4 mt-3" style={{ fontSize: 12.5, color: "#9a9a9a", lineHeight: 1.6 }}>
            <div><strong style={{ color: C.white }}>{f.name}</strong> · {f.phone}</div>
            <div>{f.type === "dine_in" ? `🍽️ ${store.tableParam} (Salão)` : f.type === "pickup" ? "🏪 Retirada na loja" : `🛵 ${f.street}, ${f.number} — ${f.district}`}</div>
            <div>💳 {f.payment}{f.needChange && f.changeFor ? ` · troco para ${f.changeFor}` : ""}</div>
          </Card>
        </div>
      )}

      <div className="mt-6 safe-bottom-plus">
        <Btn full disabled={!valid[step]} onClick={() => (step === 5 ? finish() : setStep(step + 1))}>
          {step === 5 ? `CONFIRMAR PEDIDO · ${brl(total)}` : "Continuar"}
        </Btn>
      </div>
    </div>
  );
}

// ============================================================
// ACOMPANHAMENTO
// ============================================================


export default Checkout;
