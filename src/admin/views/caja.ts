import { menuTabs } from "../../config/menu";
import { createOrder, upsertCustomer, type NewOrder } from "../actions";
import {
  balanceOf, canWrite, couponProblem, isValidPhone, looseLines, normalizePhone, quote, stockLabel, today,
} from "../logic";
import { printComanda } from "../print";
import { session, store } from "../store";
import type { AppState, Category, Customer, OrderLine, OrderType, Product, SizeId } from "../types";
import { $, cls, html, money, onAction, openDialog, raw, render, toast } from "../ui";

const CART_KEY = "cafeteria-caja";
const CATS: { id: Category | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" },
  ...menuTabs.map((t) => ({ id: t.id, label: t.label })),
  { id: "grano", label: "Grano" },
];

interface Cart {
  day: string;
  lines: OrderLine[];
  phone: string;
  guestName: string;
  type: OrderType;
  address: string;
  slot: string;
  couponId: string;
  note: string;
}

const emptyCart = (): Cart => ({ day: today(), lines: [], phone: "0", guestName: "", type: "mostrador", address: "", slot: "", couponId: "", note: "" });

function loadCart(): Cart {
  try {
    const c = JSON.parse(localStorage.getItem(CART_KEY) ?? "null") as Cart | null;
    if (c?.day === today()) return c;
  } catch {}
  return emptyCart();
}

export function mountCaja(): void {
  const user = session.user();
  if (!user) return;
  const writable = canWrite(user, "caja");

  let cart = loadCart();
  let cat: Category | "todos" = "todos";
  let search = "";
  let showSoldOut = false;
  let pendingPhone = "";

  const setCart = (next: Cart, repaint = true) => {
    cart = next;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
    if (repaint) paintTicket();
  };

  const catalogEl = $("[data-catalog]");
  const customerEl = $("[data-customer]");
  const deliveryEl = $("[data-delivery]");
  const linesEl = $("[data-lines]");
  const totalsEl = $("[data-totals]");

  const customerOf = (s: AppState): Customer | null => s.customers.find((c) => c.phone === cart.phone) ?? null;
  const reserved = (id: string) => cart.lines.filter((l) => l.productId === id).reduce((s, l) => s + l.qty, 0);

  function tile(p: Product) {
    const left = p.stock === null ? null : p.stock - reserved(p.id);
    const label = stockLabel(left);
    const out = left !== null && left <= 0;
    const chico = p.sizes.find((z) => z.id === "chico" && z.active);
    const grande = p.sizes.find((z) => z.id === "grande" && z.active);
    return html`
      <li class="relative">
        <button type="button" data-action="add" data-id="${p.id}" data-size="${chico ? "chico" : "grande"}" ${out || !writable ? raw("disabled") : ""}
          class="flex h-full min-h-28 w-full cursor-pointer flex-col items-start border-2 border-ink bg-paper p-3 text-left transition-[transform,background-color] duration-150 hover:bg-sun-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <span class="font-bold leading-tight">${p.name}</span>
          <span class="mt-auto pt-2 font-display text-[1.35rem] leading-none tabular-nums">${money((chico ?? grande)?.price ?? 0)}</span>
          ${label ? html`<span class="mt-1 text-[0.8rem] font-bold uppercase tracking-wider ${left !== null && left <= 3 ? "text-chili" : "text-caramel"}">${label}</span>` : ""}
          ${!p.promo ? "" : html`<span class="absolute right-2 top-2 size-2.5 rounded-full bg-leaf" title="Entra en combos"></span>`}
        </button>
        ${chico && grande && !out ? html`
          <button type="button" data-action="add" data-id="${p.id}" data-size="grande" ${writable ? "" : raw("disabled")}
            class="absolute bottom-2 right-2 min-h-11 cursor-pointer border-2 border-ink bg-teal px-2 font-body text-[0.8rem] font-bold uppercase hover:bg-ink hover:text-teal focus-visible:outline-3 focus-visible:outline-ink">
            Grande ${money(grande.price)}
          </button>` : ""}
      </li>`;
  }

  function paintCatalog() {
    const s = store.get();
    const q = search.trim().toLowerCase();
    const visible = s.products.filter((p) => p.active && p.sizes.some((z) => z.active) && (cat === "todos" || p.category === cat) && (!q || p.name.toLowerCase().includes(q)));
    const isOut = (p: Product) => p.stock !== null && p.stock - reserved(p.id) <= 0;
    const soldOut = visible.filter(isOut).length;
    const shown = showSoldOut ? visible : visible.filter((p) => !isOut(p));
    render(catalogEl, html`
      <div class="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Categorías">
        ${CATS.map((c) => html`<button type="button" role="tab" data-action="cat" data-cat="${c.id}" aria-selected="${cat === c.id}" class="${cls.tab} bg-paper">${c.label}</button>`)}
      </div>
      <div class="mb-4 flex flex-wrap items-end gap-3">
        <label class="min-w-0 flex-1 basis-60"><span class="${cls.label}">Buscar producto</span>
          <input type="search" data-search value="${search}" placeholder="Latte, concha, chilaquiles…" class="${cls.input}"></label>
        ${soldOut ? html`<button type="button" data-action="soldout" aria-pressed="${showSoldOut}" class="${cls.tab} bg-paper">${showSoldOut ? "Ocultar" : "Mostrar"} agotados (${soldOut})</button>` : ""}
      </div>
      ${shown.length
        ? html`<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">${shown.map(tile)}</ul>`
        : html`<p class="${cls.card} p-6 text-lg">No hay productos con ese filtro. <button type="button" data-action="clear-search" class="font-bold underline">Ver todo</button></p>`}
      <p class="mt-4 flex items-center gap-2 text-sm text-ink/75"><span class="size-2.5 rounded-full bg-leaf"></span> Entra en combos (solo tamaño chico).</p>`);
  }

  function paintCustomer(s: AppState) {
    const c = customerOf(s);
    const saldo = c ? balanceOf(s.movements, c.phone) : 0;
    const coupons = s.coupons.filter((k) => !couponProblem(k, cart.phone));
    render(customerEl, html`
      <div class="flex items-center justify-between gap-2">
        <h2 class="${cls.heading} text-[1.3rem]">Cliente</h2>
        ${cart.phone !== "0" ? html`<button type="button" data-action="general" class="min-h-11 px-2 text-sm font-bold uppercase underline">Mostrador</button>` : ""}
      </div>
      ${cart.phone === "0" ? html`
        <form data-phone-form class="mt-2 flex gap-2">
          <label class="sr-only" for="caja-phone">Teléfono del cliente</label>
          <input id="caja-phone" name="phone" type="tel" inputmode="tel" autocomplete="off" value="${pendingPhone}" placeholder="Teléfono (10 dígitos)" class="${cls.input}">
          <button class="${cls.btn.ink} shrink-0">Buscar</button>
        </form>
        <label class="mt-2 block"><span class="${cls.label}">Nombre para llamar (opcional)</span>
          <input data-field="guestName" value="${cart.guestName}" maxlength="120" placeholder="Ej. Ana" class="${cls.input}"></label>`
      : html`
        <p class="mt-1 text-lg font-bold">${c?.name}</p>
        <p class="text-sm text-ink/80">${c?.phone} · ${typeLabel(c)}${c?.discountPct ? ` · ${c.discountPct} % desc.` : ""}</p>
        ${saldo > 0 ? html`<p class="mt-1 inline-block bg-leaf px-2 py-0.5 text-sm font-bold text-cream">Saldo a favor ${money(saldo)}</p>` : ""}
        ${coupons.length ? html`
          <label class="mt-2 block"><span class="${cls.label}">Cupón</span>
            <select data-field="couponId" class="${cls.input}">
              <option value="">Sin cupón</option>
              ${coupons.map((k) => html`<option value="${k.id}" ${k.id === cart.couponId ? raw("selected") : ""}>${k.concept} · ${k.kind === "percent" ? `${k.value} %` : money(k.value)}</option>`)}
            </select></label>` : ""}`}`);
  }

  function paintDelivery(s: AppState) {
    const types: [OrderType, string][] = [["mostrador", "Mostrador"], ["recoger", "Recoger"], ["domicilio", "Domicilio"]];
    const day = today();
    const booked = (time: string, type: OrderType) => s.orders.filter((o) => o.slot === time && o.type === type && o.status < 4 && dayOf(o.createdAt) === day).length;
    render(deliveryEl, html`
      <div class="grid grid-cols-3 gap-2" role="group" aria-label="Tipo de pedido">
        ${types.map(([id, label]) => html`<button type="button" data-action="type" data-type="${id}" aria-pressed="${cart.type === id}" class="${cls.tab} bg-cream px-1 text-[0.8rem] tracking-[0.04em]">${label}</button>`)}
      </div>
      ${cart.type !== "mostrador" ? html`
        <label class="mt-3 block"><span class="${cls.label}">Horario</span>
          <select data-field="slot" class="${cls.input}">
            <option value="">Lo antes posible</option>
            ${s.settings.slots.map((sl) => {
              const limit = cart.type === "domicilio" ? sl.deliveryLimit : sl.pickupLimit;
              const left = limit - booked(sl.time, cart.type);
              return html`<option value="${sl.time}" ${sl.time === cart.slot ? raw("selected") : ""}>${sl.time}${limit < 999 ? ` · quedan ${Math.max(0, left)}` : ""}</option>`;
            })}
          </select></label>` : ""}
      ${cart.type === "domicilio" ? html`
        <label class="mt-3 block"><span class="${cls.label}">Dirección *</span>
          <input data-field="address" value="${cart.address}" autocomplete="street-address" placeholder="Calle, número, colonia" class="${cls.input}"></label>` : ""}`);
  }

  function paintLines() {
    if (!cart.lines.length) {
      render(linesEl, html`<p class="py-6 text-center text-ink/75">Toca un producto para agregarlo.</p>`);
      return;
    }
    render(linesEl, html`
      <ul class="flex flex-col gap-2">
        ${cart.lines.map((l, i) => html`
          <li class="flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold" title="${l.name}">${l.name}</p>
              <p class="text-sm text-ink/75">${l.size === "grande" ? "Grande" : "Chico"} · ${money(l.price)}</p>
            </div>
            <div class="flex items-center border-2 border-ink">
              <button type="button" data-action="qty" data-i="${i}" data-d="-1" class="grid size-11 cursor-pointer place-items-center text-xl font-bold hover:bg-sand" aria-label="Quitar uno de ${l.name}">−</button>
              <span class="w-7 text-center font-bold tabular-nums">${l.qty}</span>
              <button type="button" data-action="qty" data-i="${i}" data-d="1" class="grid size-11 cursor-pointer place-items-center text-xl font-bold hover:bg-sand" aria-label="Agregar uno de ${l.name}">+</button>
            </div>
            <span class="w-16 text-right font-bold tabular-nums">${money(l.qty * l.price)}</span>
          </li>`)}
      </ul>
      <label class="mt-3 block"><span class="${cls.label}">Nota para barra</span>
        <input data-field="note" value="${cart.note}" maxlength="500" placeholder="Sin azúcar, leche de almendra…" class="${cls.input}"></label>`);
  }

  function currentQuote(s: AppState) {
    const coupon = cart.couponId ? s.coupons.find((k) => k.id === cart.couponId) : undefined;
    return quote({ lines: cart.lines, state: s, customer: customerOf(s), coupon, channel: cart.type === "mostrador" ? "caja" : "telefono" });
  }

  function paintTotals(s: AppState) {
    const q = currentQuote(s);
    const bar = document.querySelector<HTMLElement>("[data-mobile-bar]");
    if (bar) {
      const pieces = cart.lines.reduce((n, l) => n + l.qty, 0);
      bar.hidden = pieces === 0;
      bar.querySelector("[data-mobile-count]")!.textContent = `${pieces} ${pieces === 1 ? "pieza" : "piezas"}`;
      bar.querySelector("[data-mobile-total]")!.textContent = money(q.total);
    }
    const row = (label: string, value: string, strong = false) => html`<div class="flex justify-between ${strong ? "font-display text-[1.9rem] leading-none" : ""}"><dt>${label}</dt><dd class="tabular-nums">${value}</dd></div>`;
    render(totalsEl, html`
      ${q.combos.length ? html`
        <div class="mb-3 border-2 border-leaf bg-paper p-2">
          <p class="text-[0.78rem] font-bold uppercase tracking-[0.18em] text-henequen">Combos aplicados</p>
          ${q.combos.map((c) => html`<p class="text-sm"><b>${c.name}</b> ${money(c.price)} <span class="text-ink/70">(${c.items.map((i) => i.name).join(" + ")})</span></p>`)}
        </div>` : ""}
      <dl class="flex flex-col gap-1">
        ${row("Subtotal", money(q.subtotal))}
        ${q.base < q.subtotal ? row("Ahorro combos", `−${money(q.subtotal - q.base)}`) : ""}
        ${q.discountAmount ? row(`Descuento cliente ${q.discountPct} %`, `−${money(q.discountAmount)}`) : ""}
        ${q.employeeDiscount ? row("Beneficio empleado", `−${money(q.employeeDiscount)}`) : ""}
        ${q.couponDiscount ? row("Cupón", `−${money(q.couponDiscount)}`) : ""}
        <div class="my-1 border-t-2 border-dashed border-ink/40"></div>
        ${row("Total", money(q.total), true)}
      </dl>
      <div class="mt-4 flex gap-2">
        <button type="button" data-action="clear" class="${cls.btn.ghost}" ${cart.lines.length ? "" : raw("disabled")}>Vaciar</button>
        <button type="button" data-action="checkout" class="${cls.btn.sun} flex-1 text-[1.3rem]" ${cart.lines.length && writable ? "" : raw("disabled")}>Cobrar ${money(q.total)}</button>
      </div>
      ${writable ? "" : html`<p class="mt-2 text-sm font-bold text-chili">Tu usuario solo puede consultar la caja.</p>`}`);
  }

  function paintTicket() {
    const s = store.get();
    paintCustomer(s);
    paintDelivery(s);
    paintLines();
    paintTotals(s);
    paintCatalog();
  }

  function checkout() {
    const s = store.get();
    const c = customerOf(s);
    if (!c) return toast("Verifica el cliente antes de cobrar", "error");
    if (cart.type === "domicilio" && !cart.address.trim()) return toast("Falta la dirección de entrega", "error");
    const q = currentQuote(s);
    const saldo = balanceOf(s.movements, c.phone);
    const creditOk = c.type === "empleado" && !!c.company;
    const methods = ["Efectivo", "Tarjeta", "Transferencia", "Terminal", ...(cart.type !== "mostrador" ? ["Al entregar"] : []), "Anticipo", ...(creditOk ? ["Crédito"] : [])];
    const bills = [50, 100, 200, 500].filter((b) => b >= q.total).slice(0, 3);

    openDialog({
      title: `Cobrar ${money(q.total)}`,
      submit: "Registrar venta",
      tone: "leaf",
      body: html`
        ${q.couponSkipped ? html`<p class="mb-3 bg-sun-soft p-2 text-sm">El cupón no se combina con el beneficio de empleado; quedó sin usar.</p>` : ""}
        ${saldo > 0 ? html`
          <label class="mb-4 flex min-h-11 items-center gap-3 border-2 border-leaf bg-paper px-3">
            <input type="checkbox" name="useBalance" class="size-5 accent-[var(--color-leaf)]">
            <span>Usar saldo a favor <b class="tabular-nums">${money(Math.min(saldo, q.total))}</b> de ${money(saldo)}</span>
          </label>` : ""}
        <fieldset>
          <legend class="${cls.label}">Método de pago</legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            ${methods.map((m, i) => html`
              <label class="flex min-h-11 cursor-pointer items-center justify-center border-2 border-ink bg-paper px-2 text-center font-bold has-[:checked]:bg-ink has-[:checked]:text-sun has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-sun">
                <input type="radio" name="method" value="${m}" class="sr-only" ${i === 0 ? raw("checked") : ""}>${m}
              </label>`)}
          </div>
        </fieldset>
        <div data-pane="Efectivo" class="mt-4">
          <label><span class="${cls.label}">Recibido</span>
            <input name="received" type="number" inputmode="decimal" min="0" step="0.5" value="${q.total}" class="${cls.input} text-2xl tabular-nums"></label>
          <div class="mt-2 flex flex-wrap gap-2">
            ${[q.total, ...bills].map((b) => html`<button type="button" data-bill="${b}" class="${cls.btn.ghost} min-h-11 px-3 font-body text-base font-bold">${b === q.total ? "Exacto" : money(b)}</button>`)}
          </div>
          <p class="mt-3 text-xl">Cambio: <b data-change class="tabular-nums">${money(0)}</b></p>
        </div>
        <div data-pane="Anticipo" class="mt-4 grid gap-3 sm:grid-cols-2" hidden>
          <label><span class="${cls.label}">Anticipo</span>
            <input name="deposit" type="number" inputmode="decimal" min="1" step="1" value="${Math.round(q.total / 2)}" class="${cls.input} tabular-nums"></label>
          <label><span class="${cls.label}">Pagado con</span>
            <select name="depositMethod" class="${cls.input}">${["Transferencia", "Efectivo", "Tarjeta"].map((m) => html`<option>${m}</option>`)}</select></label>
          <p class="text-sm text-ink/80 sm:col-span-2">El resto se cobra al entregar en barra.</p>
        </div>
        <div data-pane="Crédito" class="mt-4" hidden>
          <label><span class="${cls.label}">Paga ahora (el resto se fía a ${c.company})</span>
            <input name="creditPaid" type="number" inputmode="decimal" min="0" step="1" value="0" class="${cls.input} tabular-nums"></label>
          <p class="mt-2 text-sm text-ink/80">Se descuenta por nómina en el corte de quincena.</p>
        </div>
        <div data-pane="Al entregar" class="mt-4" hidden><p>Queda <b>Por cobrar</b>; barra registra el pago al entregar.</p></div>`,
      onReady: (form) => syncPanes(form, q.total, saldo),
      onInput: (form) => syncPanes(form, q.total, saldo),
      onSubmit: (data) => {
        const method = String(data.get("method"));
        const input: NewOrder = {
          channel: cart.type === "mostrador" ? "caja" : "telefono", type: cart.type,
          phone: cart.phone, guestName: cart.guestName, address: cart.address, slot: cart.slot,
          lines: cart.lines, couponId: cart.couponId || null, note: cart.note, by: user!.name,
          method: ["Anticipo", "Crédito", "Al entregar"].includes(method) ? null : method,
          received: Number(data.get("received") ?? 0),
          useBalance: data.get("useBalance") === "on",
          deposit: method === "Anticipo" ? { amount: Number(data.get("deposit")), method: String(data.get("depositMethod")) } : null,
          creditPaid: method === "Crédito" ? Number(data.get("creditPaid") ?? 0) : null,
        };
        const res = createOrder(store.get(), input);
        if (!res.ok) return res.error;
        store.set(res.state);
        setCart(emptyCart());
        showTicket(res.order!.id, input.received);
      },
    });
  }

  function syncPanes(form: HTMLFormElement, total: number, saldo: number) {
    const method = (form.elements.namedItem("method") as RadioNodeList).value;
    const useBalance = (form.elements.namedItem("useBalance") as HTMLInputElement | null)?.checked ?? false;
    const due = Math.max(0, total - (useBalance ? Math.min(saldo, total) : 0));
    form.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== method));
    const received = form.elements.namedItem("received") as HTMLInputElement;
    form.querySelector("[data-change]")!.textContent = money(Math.max(0, Number(received.value) - due));
    form.querySelectorAll<HTMLButtonElement>("[data-bill]").forEach((b) => {
      b.onclick = () => {
        received.value = b.dataset.bill === String(total) ? String(due) : b.dataset.bill!;
        syncPanes(form, total, saldo);
      };
    });
  }

  function showTicket(id: number, received: number) {
    const s = store.get();
    const o = s.orders.find((x) => x.id === id)!;
    const c = s.customers.find((x) => x.phone === o.phone);
    const change = o.payment?.method === "Efectivo" ? Math.max(0, received - (o.total - o.balanceUsed)) : 0;
    const saved = o.subtotal - o.total;
    openDialog({
      title: `Venta #${o.id}`,
      body: html`
        <p class="text-lg font-bold">${o.phone === "0" ? o.guestName || "Mostrador" : c?.name}</p>
        <ul class="mt-3 flex flex-col gap-1 border-y-2 border-dashed border-ink/40 py-3">
          ${o.combos.map((cb) => html`<li class="flex justify-between"><span><b>${cb.name}</b> <span class="text-sm text-ink/70">${cb.items.map((i) => i.name).join(" + ")}</span></span><span class="tabular-nums">${money(cb.price)}</span></li>`)}
          ${looseLines(o).map((l) => html`<li class="flex justify-between text-ink/85"><span>${l.qty}× ${l.name}${l.size === "grande" ? " (G)" : ""}</span><span class="tabular-nums">${money(l.qty * l.price)}</span></li>`)}
        </ul>
        <dl class="mt-3 flex flex-col gap-1">
          <div class="flex justify-between"><dt>Subtotal</dt><dd class="tabular-nums">${money(o.subtotal)}</dd></div>
          ${saved > 0 ? html`<div class="flex justify-between text-henequen"><dt>Ahorro (${Math.round((saved / o.subtotal) * 100)} %)</dt><dd class="tabular-nums">−${money(saved)}</dd></div>` : ""}
          <div class="flex justify-between font-display text-2xl"><dt>Total</dt><dd class="tabular-nums">${money(o.total)}</dd></div>
          <div class="flex justify-between"><dt>Pago</dt><dd>${paymentText(o.payment?.method, o)}</dd></div>
          ${change > 0 ? html`<div class="flex justify-between bg-sun px-2 py-1 text-xl font-bold"><dt>Cambio</dt><dd class="tabular-nums">${money(change)}</dd></div>` : ""}
        </dl>
        <div class="mt-5 flex flex-wrap gap-3">
          <button type="button" data-print class="${cls.btn.ghost}">Imprimir comanda</button>
          <a href="${import.meta.env.BASE_URL.replace(/\/$/, "")}/admin/barra" class="${cls.btn.ink}">Ver en barra</a>
        </div>`,
      onReady: (form) => form.querySelector("[data-print]")!.addEventListener("click", () => printComanda(o, store.get())),
    });
  }

  onAction(catalogEl, {
    add: (el) => {
      const s = store.get();
      const p = s.products.find((x) => x.id === el.dataset.id)!;
      const size = el.dataset.size as SizeId;
      const sz = p.sizes.find((x) => x.id === size && x.active);
      if (!sz) return toast(`${p.name} no tiene tamaño ${size} activo`, "error");
      const price = sz.price;
      if (p.stock !== null && reserved(p.id) + 1 > p.stock) return toast(`Solo quedan ${p.stock} de ${p.name}`, "error");
      const i = cart.lines.findIndex((l) => l.productId === p.id && l.size === size);
      const lines = i >= 0 ? cart.lines.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l)) : [...cart.lines, { productId: p.id, size, qty: 1, price, name: p.name }];
      setCart({ ...cart, lines });
    },
    cat: (el) => {
      cat = el.dataset.cat as typeof cat;
      paintCatalog();
    },
    soldout: () => {
      showSoldOut = !showSoldOut;
      paintCatalog();
    },
    "clear-search": () => {
      search = "";
      cat = "todos";
      paintCatalog();
    },
  });
  catalogEl.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.matches("[data-search]")) return;
    search = t.value;
    const pos = t.selectionStart;
    paintCatalog();
    const again = catalogEl.querySelector<HTMLInputElement>("[data-search]")!;
    again.focus();
    again.setSelectionRange(pos, pos);
  });

  const aside = catalogEl.parentElement!.querySelector("aside")!;
  onAction(aside, {
    qty: (el) => {
      const i = Number(el.dataset.i);
      const d = Number(el.dataset.d);
      const l = cart.lines[i];
      const p = store.get().products.find((x) => x.id === l.productId)!;
      if (d > 0 && p.stock !== null && reserved(p.id) + 1 > p.stock) return toast(`Solo quedan ${p.stock} de ${p.name}`, "error");
      const lines = cart.lines.map((x, j) => (j === i ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0);
      setCart({ ...cart, lines });
    },
    type: (el) => setCart({ ...cart, type: el.dataset.type as OrderType, slot: "" }),
    general: () => {
      pendingPhone = "";
      setCart({ ...cart, phone: "0", couponId: "" });
    },
    clear: () => setCart({ ...emptyCart() }),
    checkout,
  });

  aside.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    const field = t.dataset.field as keyof Cart | undefined;
    if (t.name === "phone") pendingPhone = t.value;
    if (!field) return;
    setCart({ ...cart, [field]: t.value }, false);
    if (field === "couponId") paintTotals(store.get());
  });
  aside.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;
    if (t.matches("select[data-field]")) paintTotals(store.get());
  });

  aside.addEventListener("submit", (e) => {
    const form = (e.target as HTMLElement).closest("[data-phone-form]");
    if (!form) return;
    e.preventDefault();
    const phone = normalizePhone(pendingPhone);
    if (!isValidPhone(phone) || phone === "0") return toast("Escribe un teléfono de 10 dígitos", "error");
    const found = store.get().customers.find((c) => c.phone === phone);
    if (found) {
      pendingPhone = "";
      return setCart({ ...cart, phone, couponId: "" });
    }
    openDialog({
      title: "Cliente nuevo",
      submit: "Registrar y usar",
      body: html`
        <p class="mb-3">No encontramos <b>${phone}</b>. Regístralo para acumular historial.</p>
        <label class="block"><span class="${cls.label}">Nombre *</span><input name="name" required maxlength="120" class="${cls.input}"></label>`,
      onReady: (f) => f.querySelector<HTMLInputElement>("[name=name]")!.focus(),
      onSubmit: (data) => {
        const res = upsertCustomer(store.get(), {
          phone, name: String(data.get("name") ?? ""), type: "general", discountPct: 0, company: "",
          benefit: "ninguno", benefitDailyLimit: 1, notes: "",
        });
        if (!res.ok) return res.error;
        store.set(res.state);
        pendingPhone = "";
        setCart({ ...cart, phone, couponId: "" });
      },
    });
  });

  store.subscribe(() => paintTicket());
  paintTicket();
}

const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Merida" }).format(new Date(iso));

function typeLabel(c: Customer | null): string {
  if (!c) return "";
  const t = { general: "General", frecuente: "Frecuente", empleado: `Empleado · ${c.company}`, empresa: "Empresa" }[c.type];
  return c.benefit !== "ninguno" ? `${t} · ${c.benefit === "cortesia" ? "combo cortesía" : "precio empleado"}` : t;
}

function paymentText(method: string | undefined, o: { credit: number; deposit: { amount: number; method: string } | null; balanceUsed: number; total: number }): string {
  if (o.credit > 0) return `Crédito ${money(o.credit)}`;
  if (o.deposit) return `Anticipo ${money(o.deposit.amount)} (${o.deposit.method}) · resta ${money(o.total - o.deposit.amount)}`;
  if (o.balanceUsed > 0 && method && method !== "Saldo") return `Saldo ${money(o.balanceUsed)} + ${method} ${money(o.total - o.balanceUsed)}`;
  return method ?? "Por cobrar";
}
