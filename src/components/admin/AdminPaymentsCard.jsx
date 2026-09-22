import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";
import WaiterReport from "./WaiterReport.jsx";
import LowStockAlerts from "./LowStockAlerts.jsx";

function AdminPaymentsCard({ store }) {
  const [handle, setHandle] = useState(store.settings.payHandle || "");
  const [base, setBase] = useState(store.settings.appBaseUrl || "");
  const [pixKey, setPixKey] = useState(store.settings.pixKey || "");
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/settings/payments").then((data) => {
      setInfo(data);
      if (data?.pixKey && !pixKey) setPixKey(data.pixKey);
    }).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: { pay_handle: handle, app_base_url: base, pix_key: pixKey },
      });
      await store.refreshSettings();
      setInfo(await api("/api/settings/payments"));
      store.toast("Configurações de pagamento salvas ✓");
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const copy = (t) => {
    navigator.clipboard?.writeText(t).then(
      () => store.toast("URL copiada ✓"),
      () => store.toast("Copie manualmente")
    );
  };

  const inField = { background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5 };

  return (
    <Card className="p-4" style={{ borderColor: `${C.orange}44` }}>
      <div className="flex items-center justify-between">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>💠 Pix Dinâmico & InfinitePay</div>
        <span
          className="rounded-full px-2.5 py-1 font-bold"
          style={{
            fontSize: 10,
            background: (store.settings.pixKey || store.settings.payHandle) ? `${C.green}1f` : `${C.yellow}1f`,
            color: (store.settings.pixKey || store.settings.payHandle) ? C.green : C.yellow,
            border: `1px solid ${(store.settings.pixKey || store.settings.payHandle) ? C.green : C.yellow}44`,
          }}
        >
          {(store.settings.pixKey || store.settings.payHandle) ? "ATIVO" : "CONFIGURAR"}
        </span>
      </div>
      <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
        Gere QR Code Pix com padrão oficial BACEN (Copia e Cola com valor exato) e checkout InfinitePay (Pix e cartão até 12x).
      </div>

      <div className="mt-3 space-y-2.5">
        <label className="block">
          <div className="flex items-center justify-between">
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Chave Pix Direta da Hamburgueria</span>
            <span style={{ color: C.yellowLight, fontSize: 10 }}>Padrão Banco Central</span>
          </div>
          <input
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="ex.: 81999990000 ou tonosarro@gmail.com ou CNPJ"
            className="w-full rounded-lg px-2.5 py-2 mt-1 outline-none font-mono"
            style={inField}
          />
          <span style={{ color: "#6a6a6a", fontSize: 10 }}>
            Usada para gerar o QR Code dinâmico e o código Copia e Cola com o valor exato de cada pedido.
          </span>
        </label>

        <label className="block pt-1" style={{ borderTop: `1px solid ${C.gray850}` }}>
          <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>InfiniteTag (opcional, sem o $)</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="ex.: tonosarro"
            className="w-full rounded-lg px-2.5 py-2 mt-1 outline-none"
            style={inField}
          />
        </label>
        <label className="block">
          <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>URL pública do sistema (opcional)</span>
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="ex.: https://pedidos.tonosarro.com.br"
            className="w-full rounded-lg px-2.5 py-2 mt-1 outline-none"
            style={inField}
          />
          <span style={{ color: "#6a6a6a", fontSize: 10 }}>
            Usada no webhook e no retorno do pagamento. Vazio = usa o endereço atual.
          </span>
        </label>

        {info?.webhookUrl && (
          <div>
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Webhook de confirmação</span>
            <div className="flex gap-2 mt-1">
              <code
                className="flex-1 rounded-lg px-2 py-2 truncate"
                style={{ background: C.black, border: `1px solid ${C.gray800}`, color: "#c0c0c0", fontSize: 10.5 }}
              >
                {info.webhookUrl}
              </code>
              <Btn small variant="dark" onClick={() => copy(info.webhookUrl)}>Copiar</Btn>
            </div>
            <span style={{ color: "#6a6a6a", fontSize: 10 }}>
              Já é enviado automaticamente a cada cobrança — guarde esta URL caso precise configurar algo manualmente.
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <Btn small disabled={busy} onClick={save}>{busy ? "SALVANDO…" : "Salvar"}</Btn>
        <Btn small variant="dark" onClick={() => store.toast("Teste: faça um pedido com Pix e aprove no app InfinitePay")}>
          Como testar?
        </Btn>
      </div>
    </Card>
  );
}


export default AdminPaymentsCard;
