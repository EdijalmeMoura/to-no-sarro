import React, { useState } from "react";
import { C, brl, Card, Btn, SmartImg } from "./_shared.jsx";
import { ProductForm, BADGE_OPTS } from "./_shared.jsx";

export default function AdminProducts({ store }) {
  const [form, setForm] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div style={{ color: "#8a8a8a", fontSize: 12 }}>{store.products.length} produtos cadastrados</div>
        <Btn small onClick={() => setForm("new")}>+ Novo produto</Btn>
      </div>
      {confirmDel && (
        <Card className="p-4 mb-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>Excluir “{confirmDel.name}”?</div>
          <div className="flex gap-2 mt-3">
            <Btn small variant="danger" onClick={() => { store.deleteProduct(confirmDel.id); setConfirmDel(null); }}>Excluir</Btn>
            <Btn small variant="dark" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {store.products.map((p) => (
          <Card key={p.id} className="p-3" style={{ opacity: p.available ? 1 : 0.55 }}>
            <div className="flex gap-3">
              <div className="rounded-xl overflow-hidden shrink-0" style={{ width: 56, height: 56, border: `1px solid ${C.gray800}` }}>
                <SmartImg id={p.id} emoji={p.emoji} alt={p.name} fs={26} file={p.img} v={p.updatedAt} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>{p.name}</div>
                <div style={{ color: "#7a7a7a", fontSize: 11 }}>{store.categories.find((c) => c.id === p.cat)?.label} · {p.time} min</div>
                <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 13.5 }}>{brl(p.promo || p.price)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.gray800}` }}>
              <button onClick={() => setForm(p)} className="rounded-lg px-2 py-1 font-bold" style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎ Editar</button>
              <button onClick={() => store.updateProduct(p.id, { available: !p.available })} className="rounded-full" style={{ width: 42, height: 23, background: p.available ? C.green : C.gray700, position: "relative" }}>
                <span style={{ position: "absolute", top: 3, left: p.available ? 22 : 3, width: 17, height: 17, borderRadius: 99, background: C.white }} />
              </button>
            </div>
          </Card>
        ))}
      </div>
      {form && <ProductForm key={form === "new" ? "new" : form.id} initial={form === "new" ? null : form} store={store} onClose={() => setForm(null)} />}
    </div>
  );
}
