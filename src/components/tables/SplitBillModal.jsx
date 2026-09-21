import React, { useState, useMemo } from "react";
import { C, font } from "../../constants/theme.js";
import { brl } from "../../utils/format.js";
import { Card, Btn } from "../ui/index.jsx";

export default function SplitBillModal({ table, onClose, settings }) {
  const [people, setPeople] = useState(2);
  const [serviceCharge, setServiceCharge] = useState(settings?.serviceChargeEnabled || false);
  const [customPercent, setCustomPercent] = useState(settings?.serviceChargePercent || 10);
  const [mode, setMode] = useState("equal"); // equal | byItem
  const [selectedItems, setSelectedItems] = useState({}); // itemId -> person index

  const subtotal = table?.total || 0;
  const serviceValue = serviceCharge ? subtotal * (customPercent / 100) : 0;
  const totalWithService = subtotal + serviceValue;

  const perPerson = useMemo(() => {
    if (people <= 0) return 0;
    return totalWithService / people;
  }, [totalWithService, people]);

  // By item mode: calculate per person based on selected items
  const byItemTotals = useMemo(() => {
    if (mode !== "byItem") return [];
    const totals = Array(people).fill(0);
    const items = table?.items || [];
    items.forEach((it, idx) => {
      const person = selectedItems[it.id] ?? 0;
      if (person >= 0 && person < people) {
        totals[person] += (it.unit * it.qty);
      }
    });
    // add service proportionally
    return totals.map(t => {
      const prop = subtotal > 0 ? t / subtotal : 0;
      return t + (serviceValue * prop);
    });
  }, [mode, people, table?.items, selectedItems, subtotal, serviceValue]);

  const printSplit = (personIndex = null) => {
    const isSingle = personIndex !== null;
    const amount = isSingle ? (mode === "equal" ? perPerson : byItemTotals[personIndex] || 0) : totalWithService;
    const title = isSingle ? `CONTA PESSOA ${personIndex + 1}` : `CONTA DIVIDIDA - ${table?.name}`;
    
    const itemsHtml = isSingle && mode === "byItem" 
      ? (table?.items || []).filter(it => (selectedItems[it.id] ?? 0) === personIndex).map(it => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>${it.qty}x ${it.name}</span><span>${brl(it.unit * it.qty)}</span>
        </div>`).join("")
      : (table?.items || []).map(it => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>${it.qty}x ${it.name}</span><span>${brl(it.unit * it.qty)}</span>
        </div>`).join("");

    const w = window.open("", "_blank", "width=360,height=640");
    if (!w) return;
    w.document.write(`
      <html><head><title>${title}</title></head>
      <body style="font-family:monospace; padding:12px; max-width:280px; margin:0 auto; font-size:12px;">
        <h2 style="text-align:center; margin:0 0 4px;">TÔ NO SARRO!</h2>
        <div style="text-align:center; font-size:10px; color:#666; margin-bottom:8px;">${title}</div>
        <div style="border-top:1px dashed #ccc; border-bottom:1px dashed #ccc; padding:6px 0; margin-bottom:8px;">
          <strong>${table?.name}</strong> · ${isSingle ? `Pessoa ${personIndex+1}/${people}` : `${people} pessoas`}
        </div>
        <div style="margin-bottom:8px;">${itemsHtml}</div>
        <div style="border-top:1px dashed #ccc; padding-top:6px;">
          <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>${brl(subtotal)}</span></div>
          ${serviceCharge ? `<div style="display:flex; justify-content:space-between; color:#555;"><span>Serviço (${customPercent}%):</span><span>${brl(serviceValue)}</span></div>` : ""}
          <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:14px; margin-top:4px;">
            <span>${isSingle ? "VALOR PESSOA:" : "TOTAL:"}</span><span>${brl(amount)}</span>
          </div>
          ${!isSingle ? `<div style="font-size:11px; color:#666; margin-top:6px; text-align:center;">${people}x de ${brl(perPerson)} cada</div>` : ""}
        </div>
        <div style="text-align:center; font-size:9px; color:#888; margin-top:12px;">Não é documento fiscal</div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  if (!table) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }}>
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 18, color: C.white }}>✂️ DIVIDIR CONTA</div>
            <div style={{ color: "#8a8a8a", fontSize: 12 }}>{table.name} · {table.items?.length || 0} itens · {brl(subtotal)}</div>
          </div>
          <button onClick={onClose} className="rounded-full w-8 h-8 flex items-center justify-center" style={{ background: C.gray800, color: C.white }}>✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Número de pessoas</label>
            <input type="number" min="1" max="20" value={people} onChange={e => setPeople(Math.max(1, parseInt(e.target.value)||1))} 
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none font-bold text-center" style={{ background: C.black, border: `1px solid ${C.gray700}`, color: C.white }} />
          </div>
          <div>
            <label style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Taxa serviço %</label>
            <div className="flex gap-2 mt-1">
              <button onClick={() => setServiceCharge(!serviceCharge)} className="rounded-lg px-2 py-2 text-xs font-bold" style={{ background: serviceCharge ? `${C.green}22` : C.gray850, color: serviceCharge ? C.green : "#888", border: `1px solid ${serviceCharge ? C.green : C.gray700}` }}>
                {serviceCharge ? "✓ 10%" : "Sem taxa"}
              </button>
              {serviceCharge && (
                <input type="number" min="0" max="30" value={customPercent} onChange={e => setCustomPercent(parseInt(e.target.value)||0)} 
                  className="flex-1 rounded-lg px-2 py-2 outline-none text-center text-xs" style={{ background: C.black, border: `1px solid ${C.gray700}`, color: C.white }} />
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setMode("equal")} className="flex-1 rounded-lg py-2 text-xs font-bold" style={{ background: mode==="equal" ? C.orange : C.gray850, color: mode==="equal" ? C.black : "#888", border: `1px solid ${mode==="equal" ? C.orange : C.gray700}` }}>Divisão igual</button>
          <button onClick={() => setMode("byItem")} className="flex-1 rounded-lg py-2 text-xs font-bold" style={{ background: mode==="byItem" ? C.orange : C.gray850, color: mode==="byItem" ? C.black : "#888", border: `1px solid ${mode==="byItem" ? C.orange : C.gray700}` }}>Por itens</button>
        </div>

        <div className="p-3 rounded-xl" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
          <div className="flex justify-between text-xs" style={{ color: "#8a8a8a" }}>
            <span>Subtotal:</span><span>{brl(subtotal)}</span>
          </div>
          {serviceCharge && (
            <div className="flex justify-between text-xs mt-1" style={{ color: "#8a8a8a" }}>
              <span>Serviço ({customPercent}%):</span><span>{brl(serviceValue)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm mt-2 pt-2" style={{ borderTop: `1px solid ${C.gray800}`, color: C.white }}>
            <span>Total:</span><span style={{ color: C.yellowLight }}>{brl(totalWithService)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm mt-2" style={{ color: C.green }}>
            <span>Por pessoa ({people}x):</span><span>{brl(perPerson)}</span>
          </div>
        </div>

        {mode === "byItem" && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <div style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Atribuir itens para cada pessoa:</div>
            {(table.items || []).map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
                <span style={{ fontSize: 12, color: C.white }}>{it.qty}x {it.name}</span>
                <select value={selectedItems[it.id] ?? 0} onChange={e => setSelectedItems(s => ({ ...s, [it.id]: parseInt(e.target.value) }))} 
                  className="rounded px-2 py-1 text-xs outline-none" style={{ background: C.black, color: C.white, border: `1px solid ${C.gray700}` }}>
                  {Array.from({ length: people }, (_, i) => <option key={i} value={i}>Pessoa {i+1}</option>)}
                </select>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Array.from({ length: people }, (_, i) => (
                <div key={i} className="p-2 rounded-lg text-center" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
                  <div style={{ fontSize: 10, color: "#888" }}>Pessoa {i+1}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.yellowLight }}>{brl(byItemTotals[i] || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Btn small variant="ghost" onClick={() => printSplit(null)}>🖨️ Imprimir resumo</Btn>
          <Btn small onClick={onClose}>Fechar</Btn>
        </div>

        {mode === "equal" && (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: Math.min(people, 6) }, (_, i) => (
              <button key={i} onClick={() => printSplit(i)} className="rounded-lg py-2 text-xs font-bold" style={{ background: C.gray800, color: C.white, border: `1px solid ${C.gray700}` }}>
                🖨️ Pessoa {i+1} - {brl(perPerson)}
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
