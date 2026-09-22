// OSRM integration para otimização de rotas de entrega
// Usa OSRM public demo server por padrão, mas pode ser configurado via OSRM_URL env

const OSRM_URL = process.env.OSRM_URL || "https://router.project-osrm.org";
const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";

// Cache simples em memória para geocoding
const geoCache = new Map();

export async function geocodeAddress(address) {
  if (!address) return null;
  if (geoCache.has(address)) return geoCache.get(address);
  
  try {
    const url = `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=br`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ToNoSarro/1.0 (contato@tonosarro.com)" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
    geoCache.set(address, result);
    // limpeza periódica
    if (geoCache.size > 500) {
      const first = geoCache.keys().next().value;
      geoCache.delete(first);
    }
    return result;
  } catch (e) {
    console.warn("[osrm] geocode falha:", e.message);
    return null;
  }
}

// Calcula matriz de distâncias via OSRM table service
export async function getDistanceMatrix(coords) {
  // coords: [{lng, lat}, ...]
  if (coords.length < 2) return null;
  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(";");
  const url = `${OSRM_URL}/table/v1/driving/${coordStr}?annotations=distance,duration`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM table ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok") throw new Error(`OSRM ${data.code}`);
    return data; // { distances: [[...]], durations: [[...]] }
  } catch (e) {
    console.warn("[osrm] table falha:", e.message);
    return null;
  }
}

// Otimiza ordem de entrega via OSRM trip (TSP)
export async function optimizeRoute(coords) {
  if (coords.length <= 2) return { waypoints: coords.map((_, i) => ({ waypoint_index: i, trips_index: 0 })), order: coords.map((_, i) => i) };
  
  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(";");
  // source=first = começa na loja, roundtrip=false = não volta
  const url = `${OSRM_URL}/trip/v1/driving/${coordStr}?source=first&destination=last&roundtrip=false&steps=false&annotations=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM trip ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok") throw new Error(`OSRM trip ${data.code}`);
    // data.waypoints contém ordem otimizada
    // data.trips[0].distance, duration
    const order = data.waypoints
      .slice()
      .sort((a, b) => a.trips_index - b.trips_index || a.waypoint_index - b.waypoint_index)
      .map(w => w.waypoint_index);
    return {
      waypoints: data.waypoints,
      trips: data.trips,
      order,
      distance: data.trips?.[0]?.distance || 0,
      duration: data.trips?.[0]?.duration || 0,
    };
  } catch (e) {
    console.warn("[osrm] trip falha:", e.message);
    return null;
  }
}

// Função principal: recebe pedidos com endereços, retorna ordem otimizada
export async function optimizeDeliveryRoute(orders, storeAddress) {
  // storeAddress: endereço da loja
  // orders: [{ id, customer: { addr } }, ...]
  
  const allAddresses = [storeAddress, ...orders.map(o => o.customer?.addr || o.customer_addr || "")];
  
  // Geocodifica todos
  const coords = [];
  for (const addr of allAddresses) {
    const geo = await geocodeAddress(addr);
    if (geo) coords.push({ lng: geo.lng, lat: geo.lat, addr });
    else coords.push(null);
  }

  // Se falhou geocoding para algum, retorna ordem original
  if (coords.some(c => !c)) {
    console.warn("[osrm] geocoding incompleto, retornando ordem original");
    return {
      optimized: false,
      order: orders.map((_, i) => i),
      orders,
      distance: 0,
      duration: 0,
      reason: "geocoding_incomplete"
    };
  }

  const result = await optimizeRoute(coords);
  if (!result) {
    return {
      optimized: false,
      order: orders.map((_, i) => i),
      orders,
      distance: 0,
      duration: 0,
      reason: "osrm_failed"
    };
  }

  // result.order inclui loja no índice 0, então removemos 0 e ajustamos
  // order é array de waypoint_index na ordem de visita
  const deliveryOrderIndices = result.order.filter(i => i !== 0).map(i => i - 1); // -1 porque loja é 0
  
  const optimizedOrders = deliveryOrderIndices.map(i => orders[i]).filter(Boolean);
  
  // Se por algum motivo perdeu pedidos, completa com os faltantes
  const missing = orders.filter(o => !optimizedOrders.find(oo => oo.id === o.id));
  const finalOrders = [...optimizedOrders, ...missing];

  return {
    optimized: true,
    order: deliveryOrderIndices,
    orders: finalOrders,
    distance: result.distance,
    duration: result.duration,
    waypoints: result.waypoints,
  };
}
