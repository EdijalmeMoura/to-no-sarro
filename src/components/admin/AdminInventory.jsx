import React from "react";
import { C } from "../../constants/theme.js";
import { Card, Btn } from "../ui/index.jsx";

export default function AdminInventory({ store }) {
  const low = store.inventory.filter((i) => i.qty <= i.min);
  return (
    <div>
      {low.length > 0 && (
        <Card className="p-4 mb-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.red, fontWeight: 900, fontSize: 13 }}>⚠️ Estoque baixo em {low.length} itens</div>
          <div style={{ color: "#c9c9c9", fontSize: 12, marginTop: 4 }}>{low.map((i) => i.name).join(" · ")}</div>
        </Card>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {store.inventory.map((i) => {
          const pct = Math.min(100, (i.qty / (i.min * 2.5)) * 100);
          const bad = i.qty <= i.min;
          return (
            <Card key={i.id} className="p-3">
              <div className="flex justify-between items-baseline">
                <span style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>{i.name}</span>
                <span style={{ color: bad ? C.red : C.yellowLight, fontWeight: 900, fontSize: 13 }}>{i.qty} {i.unit}</span>
              </div>
              <div style={{ height: 6, background: C.gray800, borderRadius: 9, marginTop: 8 }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 9, background: bad ? C.red : C.green }} />
              </div>
              <div className="flex items-center justify-between mt-2.5">
                <span style={{ color: "#7a7a7a", fontSize: 10.5 }}>mínimo {i.min} {i.unit}</span>
                <div className="flex gap-1.5">
                  <Btn small variant="dark" onClick={() => store.moveStock(i.id, -1)}>−1</Btn>
                  <Btn small variant="dark" onClick={() => store.moveStock(i.id, 10)}>+10</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
