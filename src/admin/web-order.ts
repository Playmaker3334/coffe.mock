import tienda from "../content/tienda.json";
import { createOrder, upsertCustomer } from "./actions";
import { normalizePhone } from "./logic";
import { store } from "./store";
import type { OrderLine } from "./types";

interface WebOrder {
  items: { id: string; name: string; price: number; qty: number }[];
  pickup: boolean;
  name: string;
  phone: string;
  address: string;
  time: string;
  payment: string;
  fee: number;
}

export function pushWebOrder(w: WebOrder): { id: number } | { error: string } {
  const phone = normalizePhone(w.phone);
  store.refresh();
  let s = store.get();
  if (!s.customers.some((c) => c.phone === phone)) {
    const res = upsertCustomer(s, { phone, name: w.name, type: "general", discountPct: 0, company: "", benefit: "ninguno", benefitDailyLimit: 1, notes: "Alta desde tienda en línea" });
    if (!res.ok) return { error: res.error };
    s = res.state;
  }
  const lines: OrderLine[] = w.items.map((i) => {
    const productId = tienda.find((t) => t.id === i.id && "item" in t)?.item ?? i.id;
    return { productId, size: "chico", qty: i.qty, price: i.price, name: i.name };
  });
  const res = createOrder(s, {
    channel: "web", type: w.pickup ? "recoger" : "domicilio", phone, guestName: "",
    address: w.address, slot: w.time, lines, couponId: null,
    note: `Paga con: ${w.payment}${w.fee > 0 ? ` · incluye envío $${w.fee}` : ""}`, by: "Tienda en línea",
    method: null, received: 0, useBalance: false, deposit: null, creditPaid: null,
  });
  if (!res.ok) return { error: res.error };
  const order = res.order!;
  const withFee = { ...order, total: order.total + w.fee };
  store.set({ ...res.state, orders: res.state.orders.map((o) => (o.id === order.id ? withFee : o)) });
  return { id: order.id };
}
