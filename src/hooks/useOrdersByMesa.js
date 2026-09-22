import { useMemo } from "react";
import { buildMesaIndex } from "../utils/mesa.js";

export function useOrdersByMesa(orders) {
  const byMesa = useMemo(() => buildMesaIndex(orders || []), [orders]);
  const getByMesa = (num) => byMesa.get(parseInt(num,10)) || [];
  return { byMesa, getByMesa };
}
