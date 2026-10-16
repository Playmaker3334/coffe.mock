import { dayKey, lanesOf, paymentLabel, STATUS_LABEL, today } from "../logic";
import { session, store } from "../store";
import type { AppState, Order } from "../types";
import { $, cls, fmtDate, fmtTime, html, money, onAction, openDialog, render, STATUS_TONE } from "../ui";

type Range = "hoy" | "7" | "30";
const RANGES: [Range, string][] = [["hoy", "Hoy"], ["7", "Últimos 7 días"], ["30", "Últimos 30 días"]];
const PAGE_SIZE = 50;
const CHANNEL: Record<Order["channel"], string> = { caja: "Caja", telefono: "Teléfono", web: "Web" };
const TYPE: Record<Order["type"], string> = { mostrador: "Mostrador", recoger: "Recoger", domicilio: "Domicilio" };

const startOf = (r: Range): string => {
  const d = new Date(`${today()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (r === "hoy" ? 0 : Number(r) - 1));
  return d.toISOString().slice(0, 10);
};

const who = (s: AppState, o: Order): string =>
  o.phone === "0" ? (o.guestName ? `${o.guestName} (mostrador)` : "Mostrador") : s.customers.find((c) => c.phone === o.phone)?.name ?? o.phone;

const pieces = (o: Order): number => o.lines.reduce((sum, l) => sum + l.qty, 0);

export function mountVentas(): void {
  if (!session.user()) return;
  const root = $("[data-ventas]");
  let range: Range = "7";
  let search = "";
  let page = 0;

  function rows(s: AppState): Order[] {
    const start = startOf(range);
    const q = search.trim().toLowerCase();
    return s.orders
      .filter((o) => dayKey(o.createdAt) >= start)
      .filter((o) => !q || String(o.id).includes(q) || o.phone.includes(q) || who(s, o).toLowerCase().includes(q) || String(o.total).includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function paintTable() {
    const s = store.get();
    const all = rows(s);
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    const shown = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const total = all.filter((o) => o.status < 4).reduce((sum, o) => sum + o.total, 0);
    render($("[data-table]", root), html`
      <p class="mb-3 font-bold" aria-live="polite">${all.length} pedidos · <span class="tabular-nums">${money(total)}</span> vendidos (sin cancelados)</p>
      <div class="${cls.card} overflow-x-auto">
        <table class="w-full min-w-[60rem] text-left">
          <caption class="sr-only">Pedidos, del más reciente al más antiguo</caption>
          <thead class="border-b-2 border-ink text-sm uppercase tracking-wider">
            <tr><th class="p-3">Folio</th><th>Fecha</th><th>Cliente</th><th class="text-right">Piezas</th><th class="text-right">Total</th><th class="pl-4">Pago</th><th>Combos</th><th>Canal</th><th class="pr-3">Estado</th></tr>
          </thead>
          <tbody>
            ${shown.length ? shown.map((o) => html`
              <tr data-action="detail" data-id="${o.id}" class="cursor-pointer border-b border-dashed border-ink/30 hover:bg-sun-soft">
                <td class="p-3"><button type="button" data-action="detail" data-id="${o.id}" class="min-h-11 font-display text-xl tabular-nums underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-ink" aria-label="Ver detalle del pedido ${o.id}">#${o.id}</button></td>
                <td class="whitespace-nowrap">${fmtDate(o.createdAt)} · ${fmtTime(o.createdAt)}</td>
                <td>${who(s, o)}</td>
                <td class="text-right tabular-nums">${pieces(o)}</td>
                <td class="text-right font-bold tabular-nums">${money(o.total)}</td>
                <td class="pl-4 text-sm">${paymentLabel(o)}</td>
                <td class="text-sm">${o.combos.length ? o.combos.map((c) => c.name).join(", ") : "—"}</td>
                <td class="text-sm">${CHANNEL[o.channel]}</td>
                <td class="pr-3"><span class="${STATUS_TONE[o.status]} whitespace-nowrap px-2 py-0.5 text-sm font-bold">${STATUS_LABEL[o.status]}</span></td>
              </tr>`) : html`<tr><td colspan="9" class="p-6 text-lg">No hay pedidos con ese filtro.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${pages > 1 ? html`
        <nav class="mt-4 flex flex-wrap items-center gap-3" aria-label="Paginación">
          <button type="button" data-action="page" data-d="-1" class="${cls.btn.ghost}" ${page === 0 ? "disabled" : ""}>Anterior</button>
          <span class="tabular-nums">Mostrando ${page * PAGE_SIZE + 1}–${Math.min(all.length, (page + 1) * PAGE_SIZE)} de ${all.length}</span>
          <button type="button" data-action="page" data-d="1" class="${cls.btn.ghost}" ${page >= pages - 1 ? "disabled" : ""}>Siguiente</button>
        </nav>` : ""}`);
  }

  function paint() {
    render(root, html`
      <div class="mb-5 flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Rango">
          ${RANGES.map(([id, label]) => html`<button type="button" role="tab" data-action="range" data-range="${id}" aria-selected="${range === id}" class="${cls.tab} bg-paper">${label}</button>`)}
        </div>
        <label class="ml-auto min-w-0 basis-72"><span class="${cls.label}">Buscar</span>
          <input type="search" data-search value="${search}" placeholder="Nombre, teléfono, folio o total" class="${cls.input}"></label>
      </div>
      <div data-table></div>`);
    paintTable();
  }

  function detail(o: Order) {
    const s = store.get();
    const coupon = o.couponId ? s.coupons.find((c) => c.id === o.couponId) : undefined;
    const row = (label: string, value: string, strong = false) => html`<div class="flex justify-between ${strong ? "font-display text-2xl" : ""}"><dt>${label}</dt><dd class="tabular-nums">${value}</dd></div>`;
    openDialog({
      title: `Pedido #${o.id}`,
      wide: true,
      body: html`
        <div class="flex flex-wrap items-center gap-2">
          <span class="${STATUS_TONE[o.status]} px-2 py-0.5 font-bold">${STATUS_LABEL[o.status]}</span>
          <span class="text-sm text-ink/80">${fmtDate(o.createdAt)} ${fmtTime(o.createdAt)} · ${CHANNEL[o.channel]} · ${TYPE[o.type]}${o.slot ? ` ${o.slot}` : ""} · capturó ${o.createdBy}</span>
        </div>
        <p class="mt-3 text-lg font-bold">${who(s, o)}${o.phone !== "0" ? html` <span class="font-normal text-ink/75">${o.phone}</span>` : ""}</p>
        ${o.address ? html`<p class="text-sm">Entregar en: ${o.address}</p>` : ""}
        <div class="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <h3 class="${cls.label}">Productos</h3>
            <ul class="flex flex-col gap-1">
              ${o.lines.map((l) => html`<li class="flex justify-between gap-2"><span>${l.qty}× ${l.name} <span class="text-sm text-ink/70">${l.size === "grande" ? "Grande" : "Chico"} · ${money(l.price)}</span></span><span class="tabular-nums">${money(l.qty * l.price)}</span></li>`)}
            </ul>
            ${o.combos.length ? html`
              <h3 class="${cls.label} mt-4">Combos</h3>
              <ul class="flex flex-col gap-1">${o.combos.map((c) => html`<li class="border-l-4 border-leaf pl-2"><b>${c.name}</b> <span class="tabular-nums">${money(c.price)}</span><br><span class="text-sm text-ink/75">${c.items.map((i) => i.name).join(" + ")}</span></li>`)}</ul>` : ""}
            ${o.notes.length ? html`
              <h3 class="${cls.label} mt-4">Notas</h3>
              ${o.notes.map((n) => html`<p class="text-sm"><b>${fmtTime(n.at)} ${n.by}:</b> ${n.text}</p>`)}` : ""}
          </div>
          <div>
            <h3 class="${cls.label}">Cuenta</h3>
            <dl class="flex flex-col gap-1">
              ${row("Subtotal", money(o.subtotal))}
              ${o.base < o.subtotal ? row("Ahorro combos", `−${money(o.subtotal - o.base)}`) : ""}
              ${o.discountAmount ? row(`Descuento cliente ${o.discountPct} %`, `−${money(o.discountAmount)}`) : ""}
              ${o.employeeDiscount ? row(`Beneficio empleado (${o.benefitCombos})`, `−${money(o.employeeDiscount)}`) : ""}
              ${o.couponDiscount ? row(`Cupón${coupon ? ` · ${coupon.concept} (${coupon.createdBy})` : ""}`, `−${money(o.couponDiscount)}`) : ""}
              ${row("Total", money(o.total), true)}
            </dl>
            <h3 class="${cls.label} mt-4">Pagos</h3>
            <ul class="flex flex-col gap-1">
              ${lanesOf(o).map((l) => html`<li class="flex justify-between"><span>${l.method}</span><span class="tabular-nums">${money(l.amount)}</span></li>`)}
              ${o.status >= 4 ? html`<li class="text-ink/75">Pedido cancelado: no cuenta en caja.</li>` : ""}
            </ul>
            ${o.payment?.method === "Efectivo" && o.payment.received > o.payment.cash ? html`<p class="mt-1 text-sm">Recibido ${money(o.payment.received)} · cambio ${money(o.payment.received - o.payment.cash)}</p>` : ""}
          </div>
        </div>`,
    });
  }

  onAction(root, {
    range: (el) => {
      range = el.dataset.range as Range;
      page = 0;
      paint();
    },
    page: (el) => {
      page += Number(el.dataset.d);
      paintTable();
    },
    detail: (el, e) => {
      e.stopPropagation();
      const o = store.get().orders.find((x) => x.id === Number(el.dataset.id));
      if (o) detail(o);
    },
  });
  root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.matches("[data-search]")) return;
    search = t.value;
    page = 0;
    paintTable();
  });

  store.subscribe(paintTable);
  paint();
}
