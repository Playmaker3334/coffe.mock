import { dayKey, today } from "../logic";
import { session, store } from "../store";
import type { AppState, Order } from "../types";
import { $, cls, fmtDate, fmtTime, html, money, onAction, render, toast } from "../ui";

type Range = "quincena" | "anterior" | "hoy" | "semana";
const RANGES: [Range, string][] = [["quincena", "Quincena actual"], ["anterior", "Quincena anterior"], ["hoy", "Hoy"], ["semana", "Semana"]];

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function fortnight(day: string, back: number): [string, string] {
  let [y, m, d] = day.split("-").map(Number);
  let half = d <= 15 ? 0 : 1;
  for (let i = 0; i < back; i++) {
    if (half === 1) half = 0;
    else {
      half = 1;
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
  }
  return half === 0 ? [key(y, m, 1), key(y, m, 15)] : [key(y, m, 16), key(y, m, lastDay(y, m))];
}

function week(day: string): [string, string] {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const k = (x: Date) => key(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
  return [k(monday), k(sunday)];
}

function bounds(range: Range): [string, string] {
  const t = today();
  if (range === "hoy") return [t, t];
  if (range === "semana") return week(t);
  return fortnight(t, range === "anterior" ? 1 : 0);
}

interface Group {
  company: string;
  total: number;
  pending: number;
  employees: { phone: string; name: string; total: number; pending: number; orders: Order[] }[];
}

function groups(s: AppState, from: string, to: string): Group[] {
  const orders = s.orders.filter((o) => o.credit > 0 && o.status < 4 && dayKey(o.createdAt) >= from && dayKey(o.createdAt) <= to);
  const byCompany = new Map<string, Map<string, Order[]>>();
  orders.forEach((o) => {
    const c = s.customers.find((x) => x.phone === o.phone);
    const company = c?.company || "Sin empresa";
    const emp = byCompany.get(company) ?? new Map<string, Order[]>();
    emp.set(o.phone, [...(emp.get(o.phone) ?? []), o]);
    byCompany.set(company, emp);
  });
  const owed = (o: Order) => o.credit;
  return [...byCompany].map(([company, emp]) => {
    const employees = [...emp].map(([phone, list]) => ({
      phone,
      name: s.customers.find((x) => x.phone === phone)?.name ?? phone,
      total: list.reduce((sum, o) => sum + o.credit, 0),
      pending: list.reduce((sum, o) => sum + owed(o), 0),
      orders: list.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    })).sort((a, b) => a.name.localeCompare(b.name));
    return { company, employees, total: employees.reduce((s2, e) => s2 + e.total, 0), pending: employees.reduce((s2, e) => s2 + e.pending, 0) };
  }).sort((a, b) => a.company.localeCompare(b.company));
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function mountCredito(): void {
  const user = session.user();
  if (!user) return;
  const root = $("[data-view]");
  let range: Range = "quincena";

  function paint() {
    const s = store.get();
    const [from, to] = bounds(range);
    const data = groups(s, from, to);
    const total = data.reduce((sum, g) => sum + g.total, 0);
    const pending = data.reduce((sum, g) => sum + g.pending, 0);
    render(root, html`
      <div class="mb-5 flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Periodo">
          ${RANGES.map(([id, label]) => html`<button type="button" role="tab" data-action="range" data-range="${id}" aria-selected="${range === id}" class="${cls.tab} bg-paper">${label}</button>`)}
        </div>
        <p class="text-ink/80">${fmtDate(`${from}T12:00:00-06:00`)} – ${fmtDate(`${to}T12:00:00-06:00`)}</p>
        <button type="button" data-action="csv" class="${cls.btn.ink} ml-auto" ${data.length ? "" : "disabled"}>Exportar CSV para nómina</button>
      </div>
      <div class="mb-6 grid gap-4 sm:grid-cols-3">
        <div class="${cls.card} p-4"><p class="${cls.kicker}">Fiado en el periodo</p><p class="font-display text-[2.2rem] leading-none tabular-nums">${money(total)}</p></div>
        <div class="${cls.card} p-4"><p class="${cls.kicker}">Por descontar</p><p class="font-display text-[2.2rem] leading-none tabular-nums text-chili">${money(pending)}</p></div>
        <div class="${cls.card} p-4"><p class="${cls.kicker}">Empleados con crédito</p><p class="font-display text-[2.2rem] leading-none tabular-nums">${data.reduce((n, g) => n + g.employees.length, 0)}</p></div>
      </div>
      ${data.length ? html`<div class="flex flex-col gap-6">${data.map((g) => html`
        <section class="${cls.card}" aria-label="${g.company}">
          <header class="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink bg-sun px-4 py-3">
            <h2 class="${cls.heading}">${g.company}</h2>
            <p class="font-bold tabular-nums">${money(g.total)} · por descontar ${money(g.pending)}</p>
          </header>
          <div class="divide-y-2 divide-dashed divide-ink/30">
            ${g.employees.map((e) => html`
              <details class="group px-4 py-3">
                <summary class="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <span class="font-bold">${e.name} <span class="font-normal text-ink/70 tabular-nums">${e.phone}</span></span>
                  <span class="tabular-nums"><b>${money(e.total)}</b> · ${e.orders.length} venta${e.orders.length === 1 ? "" : "s"}${e.pending ? html` · <span class="text-chili">debe ${money(e.pending)}</span>` : html` · <span class="text-henequen">liquidado</span>`}</span>
                </summary>
                <table class="mt-2 w-full text-left text-sm">
                  <thead class="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink/70"><tr><th class="py-1">Pedido</th><th>Fecha</th><th class="text-right">Total</th><th class="text-right">Fiado</th><th class="text-right">Estado</th></tr></thead>
                  <tbody>${e.orders.map((o) => html`
                    <tr class="border-t border-ink/15"><td class="py-1.5 font-bold tabular-nums">#${o.id}</td><td>${fmtDate(o.createdAt)} ${fmtTime(o.createdAt)}</td><td class="text-right tabular-nums">${money(o.total)}</td><td class="text-right tabular-nums">${money(o.credit)}</td><td class="text-right">${o.payment ? "Liquidado" : "Pendiente"}</td></tr>`)}
                  </tbody>
                </table>
              </details>`)}
          </div>
        </section>`)}</div>` : html`<p class="${cls.card} p-6 text-lg">No hay ventas a crédito en este periodo.</p>`}`);
  }

  function exportCsv() {
    const s = store.get();
    const [from, to] = bounds(range);
    const rows = groups(s, from, to).flatMap((g) => g.employees.flatMap((e) => e.orders.map((o) => [g.company, e.name, e.phone, o.id, dayKey(o.createdAt), o.total, o.credit, o.payment ? "Liquidado" : "Pendiente"])));
    const csv = [["Empresa", "Empleado", "Teléfono", "Pedido", "Fecha", "Total", "Fiado", "Estado"], ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `credito-${from}-a-${to}.csv` });
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV descargado");
  }

  onAction(root, {
    range: (el) => {
      range = el.dataset.range as Range;
      paint();
    },
    csv: exportCsv,
  });
  store.subscribe(paint);
  paint();
}
