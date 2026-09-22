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

function AdminUsers({ store, now }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(Object.keys(ROLE_LABELS));
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null | "new" | usuário
  const [confirmDel, setConfirmDel] = useState(null);
  const say = (m) => store.toast(m);
  const isAdmin = store.me?.role === "ADMIN";

  const load = () => {
    setLoading(true);
    api("/api/users")
      .then((d) => { setUsers(d.users); setRoles(d.roles?.length ? d.roles : Object.keys(ROLE_LABELS)); })
      .catch((e) => say(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggle = (u) =>
    api(`/api/users/${u.id}`, { method: "PATCH", body: { active: !u.active } })
      .then(() => { say(u.active ? `“${u.name}” desativado` : `“${u.name}” ativado ✓`); load(); })
      .catch((e) => say(e.message));

  const doDelete = async () => {
    try {
      await api(`/api/users/${confirmDel.id}`, { method: "DELETE" });
      say(`“${confirmDel.name}” excluído`);
      load();
    } catch (e) {
      say(e.message);
    }
    setConfirmDel(null);
  };

  const driverName = (id) => store.drivers.find((d) => d.id === id)?.name || "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div style={{ color: "#8a8a8a", fontSize: 12 }}>
          {loading ? "Carregando equipe…" : `${users.length} contas · ${users.filter((u) => u.active).length} ativas`}
        </div>
        <Btn small onClick={() => setForm("new")}>+ Novo usuário</Btn>
      </div>

      {confirmDel && (
        <Card className="p-4 mb-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>Excluir “{confirmDel.name}” ({confirmDel.username})?</div>
          <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 2 }}>O login para de funcionar na hora. Prefira desativar.</div>
          <div className="flex gap-2 mt-3">
            <Btn small variant="danger" onClick={doDelete}>Excluir de vez</Btn>
            <Btn small variant="dark" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      <Card className="p-1">
        <Table
          cols={["Nome", "Usuário", "Perfil", "Vínculo", "Último acesso", "Status", ""]}
          rows={users.map((u) => {
            const self = u.id === store.me?.id;
            return [
              <span key="n" style={{ fontWeight: 700 }}>
                {u.name} {self && <span style={{ color: C.orange, fontSize: 10, fontWeight: 800 }}> · VOCÊ</span>}
              </span>,
              <span key="u" style={{ fontSize: 12 }}>{u.username}</span>,
              <span key="r" className="rounded-md px-2 py-0.5 font-bold"
                style={{
                  background: u.role === "ADMIN" ? `${C.orange}1f` : C.gray800,
                  color: u.role === "ADMIN" ? C.orange : "#c9c9c9", fontSize: 10.5,
                }}>
                {ROLE_LABELS[u.role] || u.role}
              </span>,
              <span key="d" style={{ fontSize: 12 }}>{u.role === "ENTREGADOR" ? `🛵 ${driverName(u.driverId)}` : "—"}</span>,
              <span key="l" style={{ fontSize: 11.5 }}>{lastSeen(u.lastLoginAt, now)}</span>,
              <span key="s" className="flex items-center gap-2">
                <span style={{ opacity: self ? 0.35 : 1, display: "inline-flex" }} title={self ? "Você não pode desativar a própria conta" : ""}>
                  <MiniToggle on={u.active} onClick={() => !self && toggle(u)} />
                </span>
                <span style={{ color: u.active ? C.green : "#7a7a7a", fontSize: 10.5, fontWeight: 800 }}>
                  {u.active ? "ATIVO" : "INATIVO"}
                </span>
              </span>,
              <span key="a" className="flex items-center gap-1.5">
                <button onClick={() => setForm(u)} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎</button>
                {isAdmin && !self && (
                  <button onClick={() => setConfirmDel(u)} className="rounded-lg px-2 py-1 font-bold"
                    style={{ background: "transparent", border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }}>🗑</button>
                )}
              </span>,
            ];
          })}
        />
      </Card>
      <div style={{ color: "#6a6a6a", fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
        Desativar derruba o acesso na hora, sem apagar o histórico. Só o administrador exclui contas — e nunca a própria nem a do último administrador.
      </div>

      {form && (
        <UserForm
          key={form === "new" ? "new" : form.id}
          initial={form === "new" ? null : form}
          roles={roles}
          drivers={store.drivers}
          onClose={() => setForm(null)}
          onSaved={(m) => { setForm(null); say(m); load(); }}
        />
      )}
    </div>
  );
}


export default AdminUsers;
