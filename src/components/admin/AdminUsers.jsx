import React, { useState, useEffect } from "react";
import { C, Card, Btn } from "./_shared.jsx";
import { Table, MiniToggle, ROLE_LABELS, UserForm } from "./_shared.jsx";
import { api } from "../../utils/api.js";

export default function AdminUsers({ store, now }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(Object.keys(ROLE_LABELS));
  const [form, setForm] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [msg, setMsg] = useState("");
  const say = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = () => api("/api/users").then((d) => { setUsers(d.users); setRoles(d.roles?.length ? d.roles : Object.keys(ROLE_LABELS)); }).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const toggle = async (u) => {
    try { await api(`/api/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }); say(`${u.name} ${!u.active ? "ativado" : "desativado"}`); load(); } catch (e) { say(e.message); }
  };
  const doDelete = async () => {
    if (!confirmDel) return;
    try { await api(`/api/users/${confirmDel.id}`, { method: "DELETE" }); say("Usuário excluído"); setConfirmDel(null); load(); } catch (e) { say(e.message); }
  };

  return (
    <div className="space-y-3">
      {msg && <div className="rounded-xl px-3 py-2.5" style={{ background: `${C.orange}18`, color: C.orange, fontSize: 12.5, fontWeight: 700 }}>{msg}</div>}
      <div className="flex justify-between items-center">
        <span style={{ color: "#8a8a8a", fontSize: 12 }}>{users.length} usuários</span>
        <Btn small onClick={() => setForm("new")}>+ Novo usuário</Btn>
      </div>
      {confirmDel && (
        <Card className="p-4 mb-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>Excluir “{confirmDel.name}”?</div>
          <div className="flex gap-2 mt-3">
            <Btn small variant="danger" onClick={doDelete}>Excluir</Btn>
            <Btn small variant="dark" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}
      <Card className="p-1">
        <Table cols={["Nome", "Usuário", "Perfil", "Ativo", "Ações"]} rows={users.map((u) => [u.name, u.username, ROLE_LABELS[u.role] || u.role, <MiniToggle key="t" on={u.active} onClick={() => toggle(u)} />, <div key="a" className="flex gap-1"><button onClick={() => setForm(u)} className="rounded-lg px-2 py-1 font-bold" style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎</button><button onClick={() => setConfirmDel(u)} className="rounded-lg px-2 py-1 font-bold" style={{ background: "transparent", border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }}>🗑</button></div>])} />
      </Card>
      {form && <UserForm initial={form === "new" ? null : form} roles={roles} drivers={store.drivers} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); say(m); load(); }} />}
    </div>
  );
}
