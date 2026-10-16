import { addBalance, upsertCustomer } from "../actions";
import { balanceOf, canWrite, couponDisplayStatus } from "../logic";
import { session, store } from "../store";
import type { AppState, Customer, CustomerType } from "../types";
import { $, cls, fmtDate, fmtTime, html, money, onAction, openDialog, raw, render, toast } from "../ui";

const TYPES: [CustomerType, string][] = [["general", "General"], ["frecuente", "Frecuente"], ["empleado", "Empleado"], ["empresa", "Empresa"]];
const typeName = (t: CustomerType) => TYPES.find(([id]) => id === t)?.[1] ?? t;
const MOVE_LABEL = { abono: "Abono", consumo: "Consumo", devolucion: "Devolución" } as const;
const TOP_PRODUCTS = 5;

function stats(s: AppState, phone: string) {
  const all = s.orders.filter((o) => o.phone === phone);
  const valid = all.filter((o) => o.status < 4).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const spent = valid.reduce((sum, o) => sum + o.total, 0);
  const counts = new Map<string, number>();
  valid.forEach((o) => o.lines.forEach((l) => counts.set(l.name, (counts.get(l.name) ?? 0) + l.qty)));
  return {
    orders: valid.length,
    cancelled: all.length - valid.length,
    spent,
    avg: valid.length ? spent / valid.length : 0,
    first: valid[0]?.createdAt,
    last: valid.at(-1)?.createdAt,
    comboPct: valid.length ? Math.round((valid.filter((o) => o.combos.length).length / valid.length) * 100) : 0,
    combos: valid.reduce((sum, o) => sum + o.combos.length, 0),
    top: [...counts].sort((a, b) => b[1] - a[1]).slice(0, TOP_PRODUCTS),
  };
}

export function mountClientes(): void {
  const user = session.user();
  if (!user) return;
  const writable = canWrite(user, "clientes");
  const root = $("[data-view]");
  let search = "";
  let type: CustomerType | "todos" = "todos";

  function paint() {
    const s = store.get();
    const q = search.trim().toLowerCase();
    const list = s.customers
      .filter((c) => c.phone !== "0" && (type === "todos" || c.type === type) && (!q || c.name.toLowerCase().includes(q) || c.phone.includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    render(root, html`
      <div class="mb-5 flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de cliente">
          ${[["todos", "Todos"] as const, ...TYPES].map(([id, label]) => html`<button type="button" role="tab" data-action="type" data-type="${id}" aria-selected="${type === id}" class="${cls.tab} bg-paper">${label}</button>`)}
        </div>
        <label class="min-w-0 flex-1 basis-60"><span class="${cls.label}">Buscar</span>
          <input type="search" data-search value="${search}" placeholder="Nombre o teléfono" class="${cls.input}"></label>
        ${writable ? html`<button type="button" data-action="new" class="${cls.btn.sun}">Nuevo cliente</button>` : ""}
      </div>
      ${list.length ? html`
        <div class="${cls.card} overflow-x-auto">
          <table class="w-full min-w-[44rem] text-left">
            <thead class="border-b-2 border-ink bg-sand/60 text-[0.78rem] font-bold uppercase tracking-[0.14em]">
              <tr><th class="px-4 py-3">Cliente</th><th class="px-4 py-3">Tipo</th><th class="px-4 py-3 text-right">Desc.</th><th class="px-4 py-3 text-right">Saldo</th><th class="px-4 py-3 text-right">Pedidos</th><th class="px-4 py-3"><span class="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              ${list.map((c) => {
                const saldo = balanceOf(s.movements, c.phone);
                return html`
                  <tr class="border-b border-ink/15 last:border-0 hover:bg-sun-soft/40">
                    <td class="px-4 py-2"><p class="font-bold">${c.name}</p><p class="text-sm tabular-nums text-ink/75">${c.phone}</p></td>
                    <td class="px-4 py-2">${typeName(c.type)}${c.company ? html`<span class="block text-sm text-ink/75">${c.company}</span>` : ""}</td>
                    <td class="px-4 py-2 text-right tabular-nums">${c.discountPct ? `${c.discountPct} %` : "—"}</td>
                    <td class="px-4 py-2 text-right font-bold tabular-nums ${saldo > 0 ? "text-henequen" : ""}">${saldo ? money(saldo) : "—"}</td>
                    <td class="px-4 py-2 text-right tabular-nums">${stats(s, c.phone).orders}</td>
                    <td class="px-4 py-2">
                      <div class="flex justify-end gap-2">
                        <button type="button" data-action="view" data-phone="${c.phone}" class="${cls.btn.ghost} px-3">Ficha</button>
                        ${writable ? html`
                          <button type="button" data-action="edit" data-phone="${c.phone}" class="${cls.btn.ghost} px-3">Editar</button>
                          <button type="button" data-action="topup" data-phone="${c.phone}" class="${cls.btn.leaf} px-3">Abonar</button>` : ""}
                      </div>
                    </td>
                  </tr>`;
              })}
            </tbody>
          </table>
        </div>` : html`<p class="${cls.card} p-6 text-lg">No hay clientes con ese filtro.</p>`}`);
  }

  function ficha(phone: string) {
    const s = store.get();
    const c = s.customers.find((x) => x.phone === phone)!;
    const st = stats(s, phone);
    const moves = s.movements.filter((m) => m.phone === phone).sort((a, b) => b.at.localeCompare(a.at));
    const coupons = s.coupons.filter((k) => k.phone === phone).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const kpi = (label: string, value: string) => html`<div class="border-2 border-ink bg-paper p-3"><p class="${cls.kicker}">${label}</p><p class="font-display text-[1.6rem] leading-none tabular-nums">${value}</p></div>`;
    openDialog({
      title: c.name,
      wide: true,
      body: html`
        <p class="mb-4 text-ink/80">${c.phone} · ${typeName(c.type)}${c.company ? ` · ${c.company}` : ""}${c.discountPct ? ` · ${c.discountPct} % desc.` : ""}${c.notes ? ` · ${c.notes}` : ""}</p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          ${kpi("Pedidos", String(st.orders))}
          ${kpi("Gasto total", money(st.spent))}
          ${kpi("Ticket promedio", money(Math.round(st.avg)))}
          ${kpi("Saldo a favor", money(balanceOf(s.movements, phone)))}
        </div>
        <p class="mt-3 text-sm text-ink/80">
          ${st.cancelled} cancelado${st.cancelled === 1 ? "" : "s"} · ${st.combos} combos (${st.comboPct} % de pedidos con combo)
          ${st.first ? ` · primer pedido ${fmtDate(st.first)} · último ${fmtDate(st.last!)}` : ""}
        </p>
        <h3 class="${cls.heading} mt-5 text-[1.2rem]">Lo más pedido</h3>
        ${st.top.length ? html`<ol class="mt-2 flex flex-col gap-1">${st.top.map(([name, n], i) => html`<li class="flex justify-between border-b border-dashed border-ink/30 py-1"><span>${i + 1}. ${name}</span><b class="tabular-nums">${n}</b></li>`)}</ol>` : html`<p class="mt-2 text-ink/75">Sin pedidos todavía.</p>`}
        <h3 class="${cls.heading} mt-5 text-[1.2rem]">Movimientos de saldo</h3>
        ${moves.length ? html`
          <ul class="mt-2 flex flex-col gap-1">${moves.map((m) => html`
            <li class="flex flex-wrap justify-between gap-2 border-b border-dashed border-ink/30 py-1">
              <span><b>${MOVE_LABEL[m.type]}</b>${m.method ? ` · ${m.method}` : ""}${m.saleId ? ` · pedido #${m.saleId}` : ""} <span class="text-sm text-ink/70">${fmtDate(m.at)} ${fmtTime(m.at)} · ${m.by}</span></span>
              <b class="tabular-nums ${m.amount > 0 ? "text-henequen" : "text-chili"}">${m.amount > 0 ? "+" : "−"}${money(Math.abs(m.amount))}</b>
            </li>`)}</ul>` : html`<p class="mt-2 text-ink/75">Sin movimientos.</p>`}
        <h3 class="${cls.heading} mt-5 text-[1.2rem]">Cupones</h3>
        ${coupons.length ? html`
          <ul class="mt-2 flex flex-col gap-1">${coupons.map((k) => html`
            <li class="flex flex-wrap justify-between gap-2 border-b border-dashed border-ink/30 py-1">
              <span><b>${k.concept}</b> · ${k.kind === "percent" ? `${k.value} %` : money(k.value)} <span class="text-sm text-ink/70">emitió ${k.createdBy}</span></span>
              <span class="text-sm font-bold uppercase">${couponDisplayStatus(k)}</span>
            </li>`)}</ul>` : html`<p class="mt-2 text-ink/75">Sin cupones.</p>`}`,
    });
  }

  function edit(existing: Customer | null) {
    const c: Customer = existing ?? { phone: "", name: "", type: "general", discountPct: 0, company: "", benefit: "ninguno", benefitDailyLimit: 1, notes: "" };
    openDialog({
      title: existing ? `Editar · ${c.name}` : "Nuevo cliente",
      submit: "Guardar",
      body: html`
        <div class="grid gap-3 sm:grid-cols-2">
          <label><span class="${cls.label}">Teléfono *</span>
            <input name="phone" type="tel" inputmode="tel" value="${c.phone}" ${existing ? raw("readonly") : ""} placeholder="10 dígitos" class="${cls.input} ${existing ? "bg-stone" : ""}"></label>
          <label><span class="${cls.label}">Nombre *</span><input name="name" value="${c.name}" maxlength="120" class="${cls.input}"></label>
          <label><span class="${cls.label}">Tipo</span>
            <select name="type" class="${cls.input}">${TYPES.map(([id, label]) => html`<option value="${id}" ${c.type === id ? raw("selected") : ""}>${label}</option>`)}</select></label>
          <label><span class="${cls.label}">Descuento fijo %</span><input name="discountPct" type="number" min="0" max="100" step="1" value="${c.discountPct}" class="${cls.input} tabular-nums"></label>
          <label class="sm:col-span-2"><span class="${cls.label}">Empresa (requerida para crédito)</span><input name="company" value="${c.company}" maxlength="80" class="${cls.input}"></label>
          <label><span class="${cls.label}">Beneficio en combos</span>
            <select name="benefit" class="${cls.input}">
              ${[["ninguno", "Ninguno"], ["descuento", "Precio de empleado"], ["cortesia", "Combo cortesía ($0)"]].map(([id, label]) => html`<option value="${id}" ${c.benefit === id ? raw("selected") : ""}>${label}</option>`)}
            </select></label>
          <label><span class="${cls.label}">Tope diario de combos</span>
            <input name="limit" type="number" min="1" step="1" value="${c.benefitDailyLimit ?? ""}" placeholder="Sin tope" class="${cls.input} tabular-nums"></label>
          <label class="sm:col-span-2"><span class="${cls.label}">Notas</span><input name="notes" value="${c.notes}" maxlength="200" placeholder="Preferencias, alergias…" class="${cls.input}"></label>
        </div>
        <p class="mt-3 text-sm text-ink/75">Deja el tope vacío para que el beneficio no tenga límite diario.</p>`,
      onSubmit: (f) => {
        const limit = String(f.get("limit") ?? "").trim();
        const phone = existing ? existing.phone : String(f.get("phone") ?? "");
        if (!existing && store.get().customers.some((x) => x.phone === phone.replace(/\D/g, "").slice(-10))) return "Ese teléfono ya está registrado";
        const res = upsertCustomer(store.get(), {
          phone,
          name: String(f.get("name") ?? ""),
          type: f.get("type") as CustomerType,
          discountPct: Number(f.get("discountPct") || 0),
          company: String(f.get("company") ?? "").trim(),
          benefit: f.get("benefit") as Customer["benefit"],
          benefitDailyLimit: limit ? Math.max(1, Math.floor(Number(limit))) : null,
          notes: String(f.get("notes") ?? "").trim(),
        });
        if (!res.ok) return res.error;
        store.set(res.state);
        toast(existing ? "Cliente actualizado" : "Cliente registrado");
      },
    });
  }

  function topup(phone: string) {
    const s = store.get();
    const c = s.customers.find((x) => x.phone === phone)!;
    openDialog({
      title: `Abonar saldo · ${c.name}`,
      submit: "Registrar abono",
      tone: "leaf",
      body: html`
        <p class="mb-3">Saldo actual: <b class="tabular-nums">${money(balanceOf(s.movements, phone))}</b></p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label><span class="${cls.label}">Monto *</span><input name="amount" type="number" inputmode="decimal" min="1" step="1" class="${cls.input} tabular-nums" required></label>
          <label><span class="${cls.label}">Método *</span>
            <select name="method" class="${cls.input}">${["Efectivo", "Transferencia", "Tarjeta"].map((m) => html`<option>${m}</option>`)}</select></label>
          <label class="sm:col-span-2"><span class="${cls.label}">Fecha del pago (opcional)</span>
            <input name="date" type="date" class="${cls.input}"></label>
        </div>
        <p class="mt-2 text-sm text-ink/75">Solo se aceptan pagos de hasta 31 días atrás, nunca futuros.</p>`,
      onSubmit: (f) => {
        const date = String(f.get("date") ?? "");
        const noon = date ? new Date(`${date}T12:00:00-06:00`) : null;
        const at = noon ? new Date(Math.min(noon.getTime(), Date.now())).toISOString() : undefined;
        const res = addBalance(store.get(), phone, Number(f.get("amount")), String(f.get("method")), user!.name, at);
        if (!res.ok) return res.error;
        store.set(res.state);
        toast("Abono registrado");
      },
    });
  }

  onAction(root, {
    type: (el) => {
      type = el.dataset.type as typeof type;
      paint();
    },
    new: () => edit(null),
    view: (el) => ficha(el.dataset.phone!),
    edit: (el) => edit(store.get().customers.find((c) => c.phone === el.dataset.phone) ?? null),
    topup: (el) => topup(el.dataset.phone!),
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
  paint();
}
