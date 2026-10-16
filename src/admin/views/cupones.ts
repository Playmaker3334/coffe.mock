import { cancelCoupon } from "../actions-gestion";
import { issueCoupon } from "../actions";
import { canWrite, couponDisplayStatus, dayKey, today } from "../logic";
import { session, store } from "../store";
import type { AppState, Coupon } from "../types";
import { $, cls, confirmDialog, fmtDate, html, money, onAction, openDialog, render, toast } from "../ui";

type Range = "hoy" | "semana" | "mes" | "30";
const RANGES: [Range, string][] = [["hoy", "Hoy"], ["semana", "Semana"], ["mes", "Mes"], ["30", "30 días"]];
const DAY_MS = 86_400_000;

function since(range: Range): string {
  const t = today();
  if (range === "hoy") return t;
  if (range === "mes") return `${t.slice(0, 8)}01`;
  return dayKey(new Date(Date.now() - (range === "semana" ? 6 : 29) * DAY_MS));
}

const STATUS_TONE: Record<string, string> = {
  Activo: "bg-sun text-ink", Canjeado: "bg-leaf text-cream", Cancelado: "bg-stone text-ink", Vencido: "bg-chili text-cream",
};

export function mountCupones(): void {
  const user = session.user();
  if (!user) return;
  const writable = canWrite(user, "cupones");
  const root = $("[data-view]");
  let range: Range = "mes";

  const who = (s: AppState, phone: string) => (phone === "0" ? "Mostrador" : s.customers.find((c) => c.phone === phone)?.name ?? phone);
  const value = (c: Coupon) => (c.kind === "percent" ? `${c.value} %` : money(c.value));

  function ranking(entries: [string, Coupon[]][]) {
    const rows = entries
      .map(([name, list]) => ({ name, n: list.length, given: list.filter((c) => c.status === "used").reduce((s, c) => s + c.discountApplied, 0) }))
      .sort((a, b) => b.given - a.given || b.n - a.n)
      .slice(0, 5);
    return rows.length
      ? html`<ol class="flex flex-col">${rows.map((r, i) => html`<li class="flex justify-between gap-2 border-b border-dashed border-ink/30 py-1.5"><span>${i + 1}. ${r.name} <span class="text-sm text-ink/70">(${r.n})</span></span><b class="tabular-nums">${money(r.given)}</b></li>`)}</ol>`
      : html`<p class="text-ink/75">Sin datos.</p>`;
  }

  const groupBy = (list: Coupon[], keyOf: (c: Coupon) => string): [string, Coupon[]][] => {
    const map = new Map<string, Coupon[]>();
    list.forEach((c) => map.set(keyOf(c), [...(map.get(keyOf(c)) ?? []), c]));
    return [...map];
  };

  function paint() {
    const s = store.get();
    const from = since(range);
    const list = s.coupons.filter((c) => dayKey(c.createdAt) >= from).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const used = list.filter((c) => c.status === "used");
    const given = used.reduce((sum, c) => sum + c.discountApplied, 0);
    const kpi = (label: string, v: string, tone = "") => html`<div class="${cls.card} p-4"><p class="${cls.kicker}">${label}</p><p class="font-display text-[2.2rem] leading-none tabular-nums ${tone}">${v}</p></div>`;

    render(root, html`
      <div class="mb-5 flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Periodo">
          ${RANGES.map(([id, label]) => html`<button type="button" role="tab" data-action="range" data-range="${id}" aria-selected="${range === id}" class="${cls.tab} bg-paper">${label}</button>`)}
        </div>
        ${writable ? html`<button type="button" data-action="issue" class="${cls.btn.sun} ml-auto">Emitir cupón</button>` : ""}
      </div>
      <div class="mb-6 grid gap-4 sm:grid-cols-3">
        ${kpi("Regalado", money(given), "text-chili")}
        ${kpi("Emitidos", String(list.length))}
        ${kpi("Canjeados", String(used.length))}
      </div>
      <div class="mb-6 grid gap-4 lg:grid-cols-2">
        <section class="${cls.card} p-4"><h2 class="${cls.heading} mb-2 text-[1.3rem]">Quién regala más</h2>${ranking(groupBy(list, (c) => c.createdBy || "Sin registro"))}</section>
        <section class="${cls.card} p-4"><h2 class="${cls.heading} mb-2 text-[1.3rem]">Clientes con más cortesías</h2>${ranking(groupBy(list, (c) => who(s, c.phone)))}</section>
      </div>
      ${list.length ? html`
        <div class="${cls.card} overflow-x-auto">
          <table class="w-full min-w-[46rem] text-left">
            <thead class="border-b-2 border-ink bg-sand/60 text-[0.78rem] font-bold uppercase tracking-[0.14em]">
              <tr><th class="px-4 py-3">Fecha</th><th class="px-4 py-3">Motivo</th><th class="px-4 py-3">Cliente</th><th class="px-4 py-3">Emitió</th><th class="px-4 py-3 text-right">Valor</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3"><span class="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              ${list.map((c) => {
                const status = couponDisplayStatus(c);
                return html`
                  <tr class="border-b border-ink/15 last:border-0">
                    <td class="px-4 py-2 whitespace-nowrap">${fmtDate(c.createdAt)}</td>
                    <td class="px-4 py-2 font-bold">${c.concept}${c.expiresAt ? html`<span class="block text-sm font-normal text-ink/70">vence ${fmtDate(c.expiresAt)}</span>` : ""}</td>
                    <td class="px-4 py-2">${who(s, c.phone)}</td>
                    <td class="px-4 py-2">${c.createdBy || "Sin registro"}</td>
                    <td class="px-4 py-2 text-right tabular-nums">${value(c)}${c.status === "used" ? html`<span class="block text-sm text-ink/70">aplicó ${money(c.discountApplied)}${c.usedSaleId ? ` · #${c.usedSaleId}` : ""}</span>` : ""}</td>
                    <td class="px-4 py-2"><span class="${STATUS_TONE[status]} px-2 py-0.5 text-sm font-bold">${status}</span></td>
                    <td class="px-4 py-2 text-right">${writable && c.status === "active" ? html`<button type="button" data-action="cancel" data-id="${c.id}" class="${cls.btn.ghost} px-3">Cancelar</button>` : ""}</td>
                  </tr>`;
              })}
            </tbody>
          </table>
        </div>` : html`<p class="${cls.card} p-6 text-lg">No se emitieron cupones en este periodo.</p>`}`);
  }

  function issue() {
    const customers = store.get().customers.filter((c) => c.phone !== "0").sort((a, b) => a.name.localeCompare(b.name));
    openDialog({
      title: "Emitir cupón",
      submit: "Emitir",
      tone: "sun",
      body: html`
        <p class="mb-3">El cupón es de un solo uso, para un cliente, y queda a nombre de <b>${user!.name}</b>.</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="sm:col-span-2"><span class="${cls.label}">Cliente *</span>
            <select name="phone" class="${cls.input}">${customers.map((c) => html`<option value="${c.phone}">${c.name} · ${c.phone}</option>`)}</select></label>
          <label><span class="${cls.label}">Tipo</span>
            <select name="kind" class="${cls.input}"><option value="fixed">Monto fijo ($)</option><option value="percent">Porcentaje (%)</option></select></label>
          <label><span class="${cls.label}">Valor *</span><input name="value" type="number" min="1" step="1" required class="${cls.input} tabular-nums"></label>
          <label class="sm:col-span-2"><span class="${cls.label}">Motivo *</span><input name="concept" maxlength="80" placeholder="Cumpleaños, compensación…" required class="${cls.input}"></label>
          <label><span class="${cls.label}">Vence (opcional)</span><input name="expires" type="date" class="${cls.input}"></label>
        </div>`,
      onSubmit: (f) => {
        const expires = String(f.get("expires") ?? "");
        const res = issueCoupon(store.get(), {
          phone: String(f.get("phone")),
          kind: f.get("kind") as Coupon["kind"],
          value: Number(f.get("value")),
          concept: String(f.get("concept") ?? ""),
          expiresAt: expires ? new Date(`${expires}T23:59:59-06:00`).toISOString() : null,
          createdBy: user!.name,
        });
        if (!res.ok) return res.error;
        store.set(res.state);
        toast("Cupón emitido");
      },
    });
  }

  onAction(root, {
    range: (el) => {
      range = el.dataset.range as Range;
      paint();
    },
    issue,
    cancel: (el) =>
      confirmDialog("Cancelar cupón", "El cliente ya no podrá usarlo. Queda en la bitácora como cancelado.", "Cancelar cupón", () => {
        const res = cancelCoupon(store.get(), el.dataset.id!);
        if (!res.ok) return res.error;
        store.set(res.state);
        toast("Cupón cancelado");
      }),
  });
  store.subscribe(paint);
  paint();
}
