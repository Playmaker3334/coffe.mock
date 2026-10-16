import { addNote, courtesy, registerDeposit, registerPayment, setStatus, type Result } from "../actions";
import { canWrite, dayKey, isLocked, looseLines, paymentLabel, pendingAmount, round2, STATUS_LABEL, today } from "../logic";
import { printComanda } from "../print";
import { session, store } from "../store";
import type { AppState, Order, OrderStatus } from "../types";
import { $, cls, fmtTime, html, minutesAgo, money, onAction, openDialog, raw, render, STATUS_TONE, toast } from "../ui";

type Tab = "curso" | "entregados" | "cancelados";
const COLUMNS: { status: OrderStatus; next: OrderStatus; action: string }[] = [
  { status: 0, next: 1, action: "Preparar" },
  { status: 1, next: 2, action: "Lista" },
  { status: 2, next: 3, action: "Entregar" },
];
const CHANNEL: Record<Order["channel"], string> = { caja: "Caja", telefono: "Teléfono", web: "Web" };
const TIMER_MS = 30_000;
const LATE_MIN = 10;
const VERY_LATE_MIN = 20;

export function mountBarra(): void {
  const user = session.user();
  if (!user) return;
  const writable = canWrite(user, "barra");
  const root = $("[data-barra]");
  let tab: Tab = "curso";
  let search = "";

  const apply = (res: Result, ok?: string): string | void => {
    if (!res.ok) return res.error;
    store.set(res.state);
    if (ok) toast(ok);
  };

  const who = (s: AppState, o: Order) =>
    o.phone === "0" ? o.guestName || "Mostrador" : s.customers.find((c) => c.phone === o.phone)?.name ?? o.phone;

  const matches = (s: AppState, o: Order) => {
    const q = search.trim().toLowerCase();
    return !q || String(o.id).includes(q) || who(s, o).toLowerCase().includes(q);
  };

  const byTime = (a: Order, b: Order) => (a.slot || "99").localeCompare(b.slot || "99") || a.createdAt.localeCompare(b.createdAt);

  function items(o: Order) {
    const loose = looseLines(o);
    return html`
      ${o.combos.map((c) => html`
        <li class="border-l-4 border-leaf pl-2"><span class="text-[0.75rem] font-bold uppercase tracking-wider text-henequen">${c.name}</span>
          ${c.items.map((i) => html`<span class="block font-bold">${i.name}</span>`)}</li>`)}
      ${loose.map((l) => html`<li class="font-bold"><span class="tabular-nums">${l.qty}×</span> ${l.name}${l.size === "grande" ? html` <span class="bg-teal px-1 text-sm">G</span>` : ""}</li>`)}`;
  }

  function card(s: AppState, o: Order) {
    const age = minutesAgo(o.createdAt);
    const ageTone = o.status >= 3 ? "bg-stone" : age >= VERY_LATE_MIN ? "bg-chili text-cream" : age >= LATE_MIN ? "bg-orange" : "bg-sand";
    const unpaid = !o.payment && o.credit < o.total;
    const col = COLUMNS.find((c) => c.status === o.status);
    return html`
      <article class="${cls.card} flex flex-col" aria-label="Pedido ${o.id}">
        <header class="flex items-start justify-between gap-2 border-b-2 border-ink px-3 py-2">
          <div>
            <p class="font-display text-[1.9rem] leading-none tabular-nums">#${o.id}</p>
            <p class="font-bold">${who(s, o)}</p>
          </div>
          <div class="flex flex-col items-end gap-1 text-right">
            <span class="${ageTone} px-2 py-0.5 text-sm font-bold tabular-nums">${o.status >= 3 ? fmtTime(o.statusAt) : `hace ${age} min`}</span>
            <span class="text-[0.75rem] font-bold uppercase tracking-wider text-ink/75">${CHANNEL[o.channel]} · ${o.type === "mostrador" ? "Mostrador" : o.type === "recoger" ? "Recoger" : "Domicilio"}${o.slot ? ` ${o.slot}` : ""}</span>
          </div>
        </header>
        <ul class="flex flex-col gap-1.5 px-3 py-3">${items(o)}</ul>
        ${o.address ? html`<p class="mx-3 mb-2 text-sm"><b>Entregar en:</b> ${o.address}</p>` : ""}
        ${o.notes.length ? html`<div class="mx-3 mb-2 bg-sun-soft p-2 text-sm">${o.notes.map((n) => html`<p><b>${fmtTime(n.at)} ${n.by}:</b> ${n.text}</p>`)}</div>` : ""}
        <footer class="mt-auto flex flex-wrap items-center gap-2 border-t-2 border-dashed border-ink/40 px-3 py-2">
          <span class="${unpaid ? "border-2 border-chili text-chili" : "bg-leaf text-cream"} px-2 py-0.5 text-sm font-bold">${paymentLabel(o)}</span>
          <span class="ml-auto font-display text-xl tabular-nums">${money(o.total)}</span>
        </footer>
        ${writable ? html`
          <div class="flex gap-2 px-3 pb-3">
            <button type="button" data-action="more" data-id="${o.id}" class="${cls.btn.ghost} px-3">Más</button>
            ${col ? html`<button type="button" data-action="advance" data-id="${o.id}" class="${col.next === 3 ? cls.btn.leaf : cls.btn.ink} flex-1">${col.next === 3 && unpaid ? "Cobrar y entregar" : col.action}</button>` : ""}
            ${o.status === 3 ? html`<button type="button" data-action="reopen" data-id="${o.id}" class="${cls.btn.ghost} flex-1">Regresar a pendientes</button>` : ""}
          </div>` : ""}
      </article>`;
  }

  function paint() {
    const s = store.get();
    const day = today();
    const active = s.orders.filter((o) => o.status < 3 && matches(s, o)).sort(byTime);
    const delivered = s.orders.filter((o) => o.status === 3 && dayKey(o.statusAt) === day && matches(s, o)).sort((a, b) => b.statusAt.localeCompare(a.statusAt));
    const cancelled = s.orders.filter((o) => o.status >= 4 && dayKey(o.statusAt) === day && matches(s, o));
    const tabs: [Tab, string, number][] = [["curso", "En curso", active.length], ["entregados", "Entregados hoy", delivered.length], ["cancelados", "Cancelados hoy", cancelled.length]];
    const list = (orders: Order[], empty: string) =>
      orders.length ? html`<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">${orders.slice(0, 60).map((o) => card(s, o))}</div>` : html`<p class="${cls.card} p-6 text-lg">${empty}</p>`;

    render(root, html`
      <div class="mb-5 flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2" role="tablist">
          ${tabs.map(([id, label, n]) => html`<button type="button" role="tab" data-action="tab" data-tab="${id}" aria-selected="${tab === id}" class="${cls.tab} bg-paper">${label} <span class="tabular-nums">(${n})</span></button>`)}
        </div>
        <label class="ml-auto min-w-0 basis-64"><span class="${cls.label}">Buscar</span>
          <input type="search" data-search value="${search}" placeholder="Nombre o número" class="${cls.input}"></label>
      </div>
      ${tab === "curso" ? html`
        <div class="grid gap-5 lg:grid-cols-3">
          ${COLUMNS.map((c) => {
            const orders = active.filter((o) => o.status === c.status);
            return html`
              <section aria-label="${STATUS_LABEL[c.status]}" class="min-w-0">
                <h2 class="mb-3 flex items-center gap-2 font-display text-[1.5rem] uppercase"><span class="${STATUS_TONE[c.status]} px-2">${STATUS_LABEL[c.status]}</span><span class="tabular-nums text-ink/70">${orders.length}</span></h2>
                <div class="flex flex-col gap-4">${orders.length ? orders.map((o) => card(s, o)) : html`<p class="border-2 border-dashed border-ink/40 p-5 text-center text-ink/70">Sin pedidos</p>`}</div>
              </section>`;
          })}
        </div>` : tab === "entregados" ? list(delivered, "Aún no se entrega nada hoy.") : list(cancelled, "Sin cancelaciones hoy.")}`);
  }

  function charge(o: Order, then: () => void) {
    const due = pendingAmount(o);
    if (due <= 0) {
      openDialog({
        title: `Entregar #${o.id}`, submit: "Entregar", tone: "leaf",
        body: html`<p class="text-lg">${o.total === 0 ? "Cortesía — nada por cobrar." : `Pagado: ${paymentLabel(o)}.`}</p>`,
        onSubmit: () => {
          const res = registerPayment(store.get(), o.id, { method: o.total === 0 ? "Cortesía" : o.payment?.method ?? "Saldo", cash: 0, other: 0, otherMethod: "", received: 0 });
          return apply(res) ?? then();
        },
      });
      return;
    }
    openDialog({
      title: `Cobrar #${o.id} · ${money(due)}`, submit: "Cobrar y entregar", tone: "leaf",
      body: html`
        <fieldset><legend class="${cls.label}">Método</legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            ${["Efectivo", "Tarjeta", "Transferencia", "Terminal", "Mixto"].map((m, i) => html`
              <label class="flex min-h-11 cursor-pointer items-center justify-center border-2 border-ink bg-paper font-bold has-[:checked]:bg-ink has-[:checked]:text-sun has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-sun">
                <input type="radio" name="method" value="${m}" class="sr-only" ${i === 0 ? raw("checked") : ""}>${m}</label>`)}
          </div></fieldset>
        <div data-pane="Efectivo" class="mt-4">
          <label><span class="${cls.label}">Recibido</span><input name="received" type="number" inputmode="decimal" step="0.5" min="0" value="${due}" class="${cls.input} text-2xl tabular-nums"></label>
          <p class="mt-2 text-xl">Cambio: <b data-change class="tabular-nums">${money(0)}</b></p>
        </div>
        <div data-pane="Mixto" class="mt-4 grid gap-3 sm:grid-cols-3" hidden>
          <label><span class="${cls.label}">Efectivo</span><input name="cash" type="number" inputmode="decimal" step="0.5" min="0" value="0" class="${cls.input} tabular-nums"></label>
          <label><span class="${cls.label}">Otro método</span><select name="otherMethod" class="${cls.input}">${["Transferencia", "Tarjeta", "Terminal"].map((m) => html`<option>${m}</option>`)}</select></label>
          <label><span class="${cls.label}">Monto</span><input name="other" type="number" inputmode="decimal" step="0.5" min="0" value="${due}" class="${cls.input} tabular-nums" readonly></label>
        </div>`,
      onInput: (form) => {
        const f = new FormData(form);
        const method = String(f.get("method"));
        form.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== method));
        form.querySelector("[data-change]")!.textContent = money(Math.max(0, Number(f.get("received")) - due));
        (form.elements.namedItem("other") as HTMLInputElement).value = String(round2(Math.max(0, due - Number(f.get("cash")))));
      },
      onSubmit: (f) => {
        const method = String(f.get("method"));
        const res = registerPayment(store.get(), o.id, {
          method, received: Number(f.get("received") ?? 0),
          cash: method === "Mixto" ? Number(f.get("cash")) : 0,
          other: method === "Mixto" ? Number(f.get("other")) : 0,
          otherMethod: method === "Mixto" ? String(f.get("otherMethod")) : "",
        });
        return apply(res) ?? then();
      },
    });
  }

  function more(o: Order) {
    const locked = isLocked(o);
    const canDeposit = !locked && !o.payment && !o.deposit && !o.balanceUsed && !o.credit;
    const dlg = openDialog({
      title: `Pedido #${o.id}`,
      body: html`
        <div class="grid gap-2 sm:grid-cols-2">
          <button type="button" data-do="print" class="${cls.btn.ghost}">Imprimir comanda</button>
          <button type="button" data-do="note" class="${cls.btn.ghost}">Agregar nota</button>
          ${!locked && !o.payment ? html`<button type="button" data-do="courtesy" class="${cls.btn.ghost}">Cortesía / ajustar cobro</button>` : ""}
          ${canDeposit ? html`<button type="button" data-do="deposit" class="${cls.btn.ghost}">Registrar anticipo</button>` : ""}
          ${o.status > 0 && !locked ? html`<button type="button" data-do="back" class="${cls.btn.ghost}">Regresar a pendiente</button>` : ""}
        </div>
        ${!locked ? html`
          <div class="mt-5 border-t-2 border-dashed border-ink/40 pt-4">
            <p class="${cls.label}">Cancelar pedido (devuelve existencias y saldo)</p>
            <div class="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" data-do="cancel4" class="${cls.btn.danger}">No pasó</button>
              <button type="button" data-do="cancel5" class="${cls.btn.danger}">Canceló el cliente</button>
            </div>
          </div>` : ""}`,
    });
    dlg.addEventListener("click", (e) => {
      const action = (e.target as HTMLElement).closest<HTMLElement>("[data-do]")?.dataset.do;
      if (!action) return;
      dlg.close();
      const s = store.get();
      if (action === "print") printComanda(o, s);
      if (action === "back") apply(setStatus(s, o.id, 0, user!.name));
      if (action === "cancel4" || action === "cancel5") apply(setStatus(s, o.id, action === "cancel4" ? 4 : 5, user!.name), `Pedido #${o.id} cancelado`);
      if (action === "note") openDialog({
        title: `Nota · #${o.id}`, submit: "Agregar",
        body: html`<label><span class="${cls.label}">Nota (se agrega con tu nombre y hora)</span><textarea name="text" rows="3" maxlength="500" class="${cls.input} py-2"></textarea></label>`,
        onSubmit: (f) => apply(addNote(store.get(), o.id, String(f.get("text") ?? ""), user!.name)),
      });
      if (action === "deposit") openDialog({
        title: `Anticipo · #${o.id}`, submit: "Registrar",
        body: html`
          <div class="grid gap-3 sm:grid-cols-2">
            <label><span class="${cls.label}">Monto</span><input name="amount" type="number" min="1" step="1" value="${Math.round(o.total / 2)}" class="${cls.input} tabular-nums"></label>
            <label><span class="${cls.label}">Método</span><select name="method" class="${cls.input}">${["Transferencia", "Efectivo", "Tarjeta"].map((m) => html`<option>${m}</option>`)}</select></label>
          </div>`,
        onSubmit: (f) => apply(registerDeposit(store.get(), o.id, Number(f.get("amount")), String(f.get("method"))), "Anticipo registrado"),
      });
      if (action === "courtesy") openDialog({
        title: `Cortesía · #${o.id}`, submit: "Aplicar cortesía", tone: "sun",
        body: html`
          <p class="mb-3">Queda registrada a nombre de <b>${user!.name}</b> en la bitácora de cupones.</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label><span class="${cls.label}">Monto a descontar</span><input name="amount" type="number" min="1" step="1" max="${o.total + o.couponDiscount}" class="${cls.input} tabular-nums" required></label>
            <label><span class="${cls.label}">Motivo</span><input name="concept" maxlength="80" placeholder="Bebida equivocada" class="${cls.input}" required></label>
          </div>`,
        onSubmit: (f) => apply(courtesy(store.get(), o.id, Number(f.get("amount")), String(f.get("concept") ?? ""), user!.name), "Cortesía aplicada"),
      });
    });
  }

  const find = (el: HTMLElement) => store.get().orders.find((o) => o.id === Number(el.dataset.id))!;
  onAction(root, {
    tab: (el) => {
      tab = el.dataset.tab as Tab;
      paint();
    },
    advance: (el) => {
      const o = find(el);
      const col = COLUMNS.find((c) => c.status === o.status)!;
      const go = () => {
        const err = apply(setStatus(store.get(), o.id, col.next, user.name));
        if (err) toast(err, "error");
        else if (col.next === 3) toast(`#${o.id} entregado`);
      };
      if (col.next === 3 && !store.get().orders.find((x) => x.id === o.id)!.payment) charge(o, go);
      else go();
    },
    reopen: (el) => {
      const err = apply(setStatus(store.get(), Number(el.dataset.id), 0, user.name));
      if (err) toast(err, "error");
    },
    more: (el) => more(find(el)),
  });
  root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.matches("[data-search]")) return;
    search = t.value;
    paint();
    const again = root.querySelector<HTMLInputElement>("[data-search]")!;
    again.focus();
    again.setSelectionRange(search.length, search.length);
  });

  store.subscribe(paint);
  setInterval(() => !document.querySelector("dialog[open]") && paint(), TIMER_MS);
  paint();
}
