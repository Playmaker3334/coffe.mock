import { menuTabs } from "../../config/menu";
import { dayKey, hourKey, lanesOf, round2, today } from "../logic";
import { session, store } from "../store";
import type { AppState, Category, Order, OrderType } from "../types";
import { $, cls, html, money, onAction, render, toast } from "../ui";

type Period = "hoy" | "semana" | "mes" | "7" | "30" | "rango";
const PERIODS: [Period, string][] = [["hoy", "Hoy"], ["semana", "Semana"], ["mes", "Mes"], ["7", "Últimos 7"], ["30", "Últimos 30"], ["rango", "Rango"]];
const MAX_RANGE_DAYS = 92;
const OPEN_HOUR = 7;
const CLOSE_HOUR = 21;
const TOP_PRODUCTS = 10;
const CAT_LABEL: Record<Category, string> = { ...Object.fromEntries(menuTabs.map((t) => [t.id, t.label])), grano: "Café en grano" } as Record<Category, string>;
const TYPE_LABEL: Record<OrderType, string> = { mostrador: "Mostrador", recoger: "Recoger", domicilio: "Domicilio" };

const addDays = (key: string, n: number): string => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (key: string): number => new Date(`${key}T12:00:00Z`).getUTCDay();
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const shortDay = (key: string): string =>
  new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${key}T12:00:00Z`));

function rangeOf(period: Period, from: string, to: string): [string, string] {
  const t = today();
  if (period === "hoy") return [t, t];
  if (period === "semana") return [addDays(t, -((weekday(t) + 6) % 7)), t];
  if (period === "mes") return [`${t.slice(0, 8)}01`, t];
  if (period === "7") return [addDays(t, -6), t];
  if (period === "30") return [addDays(t, -29), t];
  return [from, to];
}

interface Bucket { key: string; label: string; amount: number; orders: number }

function summarize(s: AppState, start: string, end: string) {
  const inRange = (iso: string) => {
    const d = dayKey(iso);
    return d >= start && d <= end;
  };
  const all = s.orders.filter((o) => inRange(o.createdAt));
  const valid = all.filter((o) => o.status < 4);
  const sold = round2(valid.reduce((sum, o) => sum + o.total, 0));
  const lanes = s.orders.flatMap(lanesOf).filter((l) => inRange(l.at));
  const byMethod = new Map<string, number>();
  lanes.forEach((l) => byMethod.set(l.method, round2((byMethod.get(l.method) ?? 0) + l.amount)));
  const cashDeposits = s.movements.filter((m) => m.type === "abono" && m.method === "Efectivo" && inRange(m.at)).reduce((sum, m) => sum + m.amount, 0);

  const single = start === end;
  const buckets: Bucket[] = single
    ? Array.from({ length: CLOSE_HOUR - OPEN_HOUR + 1 }, (_, i) => {
        const h = String(OPEN_HOUR + i).padStart(2, "0");
        return { key: h, label: `${OPEN_HOUR + i}h`, amount: 0, orders: 0 };
      })
    : Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => {
        const k = addDays(start, i);
        return { key: k, label: shortDay(k), amount: 0, orders: 0 };
      });
  valid.forEach((o) => {
    const key = single ? hourKey(o.createdAt).slice(0, 2) : dayKey(o.createdAt);
    const b = buckets.find((x) => x.key === key);
    if (b) {
      b.amount = round2(b.amount + o.total);
      b.orders += 1;
    }
  });

  const byCategory = new Map<Category, number>();
  const byType = new Map<OrderType, number>();
  const products = new Map<string, { name: string; qty: number; amount: number; sizes: Record<string, number> }>();
  valid.forEach((o: Order) => {
    byType.set(o.type, (byType.get(o.type) ?? 0) + 1);
    o.lines.forEach((l) => {
      const p = s.products.find((x) => x.id === l.productId);
      const catalog = p?.sizes.find((x) => x.id === l.size)?.price ?? l.price;
      if (p) byCategory.set(p.category, round2((byCategory.get(p.category) ?? 0) + catalog * l.qty));
      const cur = products.get(l.productId) ?? { name: l.name, qty: 0, amount: 0, sizes: {} };
      products.set(l.productId, {
        ...cur, qty: cur.qty + l.qty, amount: round2(cur.amount + catalog * l.qty),
        sizes: { ...cur.sizes, [l.size]: (cur.sizes[l.size] ?? 0) + l.qty },
      });
    });
  });

  return {
    single, buckets, sold, orders: valid.length, cancelled: all.length - valid.length,
    ticket: valid.length ? round2(sold / valid.length) : 0,
    cashExpected: round2((byMethod.get("Efectivo") ?? 0) + cashDeposits),
    pending: byMethod.get("Por cobrar") ?? 0,
    credit: byMethod.get("Crédito") ?? 0,
    byMethod: [...byMethod].sort((a, b) => b[1] - a[1]),
    byCategory: [...byCategory].sort((a, b) => b[1] - a[1]),
    byType: (["mostrador", "recoger", "domicilio"] as OrderType[]).map((t) => [t, byType.get(t) ?? 0] as const),
    top: [...products.values()].sort((a, b) => b.qty - a.qty).slice(0, TOP_PRODUCTS),
  };
}

export function mountCierre(): void {
  if (!session.user()) return;
  const root = $("[data-cierre]");
  let period: Period = "hoy";
  let from = addDays(today(), -6);
  let to = today();

  const kpi = (label: string, value: string, note = "") => html`
    <div class="${cls.card} p-4">
      <p class="${cls.kicker}">${label}</p>
      <p class="font-display text-[2rem] leading-none tabular-nums">${value}</p>
      ${note ? html`<p class="mt-1 text-sm text-ink/75">${note}</p>` : ""}
    </div>`;

  function chart(buckets: Bucket[], single: boolean) {
    const max = Math.max(...buckets.map((b) => b.amount), 0);
    const peak = buckets.findIndex((b) => b.amount === max && max > 0);
    if (!max) return html`<p class="${cls.card} p-6 text-lg">Sin ventas en el periodo.</p>`;
    const dense = buckets.length > 16;
    return html`
      <figure class="${cls.card} p-4">
        <figcaption class="flex flex-wrap items-baseline justify-between gap-2">
          <span class="${cls.heading} text-[1.3rem]">Ventas por ${single ? "hora" : "día"}</span>
          <span class="text-sm text-ink/75">Máximo: <b class="tabular-nums">${money(max)}</b> · ${buckets[peak].label}</span>
        </figcaption>
        <div class="relative mt-6 h-56" role="img" aria-label="Ventas por ${single ? "hora" : "día"}; máximo ${money(max)} en ${buckets[peak].label}">
          <div class="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            ${[0, 1, 2, 3].map(() => html`<div class="border-t border-ink/10"></div>`)}
          </div>
          <div class="relative flex h-full items-end gap-[2px]">
            ${buckets.map((b, i) => html`
              <div class="group relative flex h-full min-w-0 flex-1 items-end" tabindex="0" aria-label="${b.label}: ${money(b.amount)}, ${b.orders} pedidos">
                <div class="w-full rounded-t-[4px] ${i === peak ? "bg-roast" : "bg-caramel/70 group-hover:bg-caramel"}" style="height:${Math.max(b.amount ? 2 : 0, (b.amount / max) * 100)}%"></div>
                ${i === peak ? html`<span class="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pb-1 text-xs font-bold tabular-nums" style="bottom:${(b.amount / max) * 100}%">${money(b.amount)}</span>` : ""}
                <span class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-6 hidden -translate-x-1/2 whitespace-nowrap border-2 border-ink bg-paper px-2 py-1 text-sm shadow-[3px_3px_0_0_var(--color-ink)] group-hover:block group-focus:block">
                  <b>${b.label}</b> · <span class="tabular-nums">${money(b.amount)}</span> · ${b.orders} ped.
                </span>
              </div>`)}
          </div>
        </div>
        <div class="mt-2 flex gap-[2px] text-[0.7rem] text-ink/75" aria-hidden="true">
          ${buckets.map((b, i) => html`<span class="min-w-0 flex-1 truncate text-center">${!dense || i % Math.ceil(buckets.length / 10) === 0 ? b.label : ""}</span>`)}
        </div>
        <details class="mt-3">
          <summary class="min-h-11 cursor-pointer py-2 font-bold">Ver como tabla</summary>
          <table class="w-full text-sm">
            <thead><tr class="border-b-2 border-ink text-left"><th class="py-1">${single ? "Hora" : "Día"}</th><th class="text-right">Pedidos</th><th class="text-right">Ventas</th></tr></thead>
            <tbody>${buckets.map((b) => html`<tr class="border-b border-dashed border-ink/20"><td class="py-1">${b.label}</td><td class="text-right tabular-nums">${b.orders}</td><td class="text-right tabular-nums">${money(b.amount)}</td></tr>`)}</tbody>
          </table>
        </details>
      </figure>`;
  }

  function breakdown(title: string, rows: readonly (readonly [string, number])[], total: number, asMoney = true) {
    return html`
      <section class="${cls.card} p-4" aria-label="${title}">
        <h2 class="${cls.heading} text-[1.3rem]">${title}</h2>
        ${rows.length ? html`
          <ul class="mt-3 flex flex-col gap-2">
            ${rows.map(([label, v]) => {
              const pct = total ? Math.round((v / total) * 100) : 0;
              return html`
                <li>
                  <div class="flex justify-between gap-2"><span>${label}</span><span class="tabular-nums"><b>${asMoney ? money(v) : v}</b> · ${pct} %</span></div>
                  <div class="mt-1 h-2 bg-stone"><div class="h-full rounded-r-[4px] bg-henequen" style="width:${pct}%"></div></div>
                </li>`;
            })}
          </ul>` : html`<p class="mt-3 text-ink/75">Sin datos.</p>`}
      </section>`;
  }

  function paint() {
    const [start, end] = rangeOf(period, from, to);
    const r = summarize(store.get(), start, end);
    const methodTotal = r.byMethod.reduce((s, [, v]) => s + v, 0);
    const catTotal = r.byCategory.reduce((s, [, v]) => s + v, 0);
    render(root, html`
      <div class="mb-6 flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Periodo">
          ${PERIODS.map(([id, label]) => html`<button type="button" role="tab" data-action="period" data-period="${id}" aria-selected="${period === id}" class="${cls.tab} bg-paper">${label}</button>`)}
        </div>
        ${period === "rango" ? html`
          <form data-range class="flex flex-wrap items-end gap-2">
            <label><span class="${cls.label}">Desde</span><input type="date" name="from" value="${from}" max="${today()}" class="${cls.input}"></label>
            <label><span class="${cls.label}">Hasta</span><input type="date" name="to" value="${to}" max="${today()}" class="${cls.input}"></label>
            <button class="${cls.btn.ink}">Aplicar</button>
          </form>` : ""}
        <p class="ml-auto font-bold text-ink/80">${start === end ? shortDay(start) : `${shortDay(start)} – ${shortDay(end)}`}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        ${kpi("Vendido", money(r.sold), `${r.orders} pedidos`)}
        ${kpi("Ticket promedio", money(r.ticket))}
        ${kpi("Efectivo esperado", money(r.cashExpected), "Ventas + abonos en efectivo, sin fondo")}
        ${kpi("Canceladas", String(r.cancelled))}
        ${kpi("Por cobrar", money(r.pending))}
        ${kpi("Crédito", money(r.credit), "Se descuenta por nómina")}
      </div>

      <div class="mt-6">${chart(r.buckets, r.single)}</div>

      <div class="mt-6 grid gap-4 lg:grid-cols-3">
        ${breakdown("Por método", r.byMethod, methodTotal)}
        ${breakdown("Por categoría", r.byCategory.map(([c, v]) => [CAT_LABEL[c], v] as const), catTotal)}
        ${breakdown("Tipo de pedido", r.byType.map(([t, n]) => [TYPE_LABEL[t], n] as const), r.orders, false)}
      </div>
      <p class="mt-2 text-sm text-ink/70">La categoría se calcula a precio de catálogo (antes de combos y descuentos).</p>

      <section class="${cls.card} mt-6 overflow-x-auto" aria-label="Productos más vendidos">
        <table class="w-full min-w-[32rem] text-left">
          <caption class="p-4 text-left"><span class="${cls.heading} text-[1.3rem]">Más vendidos</span></caption>
          <thead class="border-b-2 border-ink text-sm uppercase tracking-wider"><tr><th class="px-4 py-2">Producto</th><th>Tamaños</th><th class="text-right">Piezas</th><th class="px-4 text-right">Importe</th></tr></thead>
          <tbody>
            ${r.top.length ? r.top.map((p) => html`
              <tr class="border-b border-dashed border-ink/30">
                <td class="px-4 py-2 font-bold">${p.name}</td>
                <td class="text-sm">${Object.entries(p.sizes).map(([k, v]) => `${k === "grande" ? "Grande" : "Chico"} ${v}`).join(" · ")}</td>
                <td class="text-right tabular-nums">${p.qty}</td>
                <td class="px-4 text-right tabular-nums">${money(p.amount)}</td>
              </tr>`) : html`<tr><td colspan="4" class="p-4 text-ink/75">Sin ventas.</td></tr>`}
          </tbody>
        </table>
      </section>`);
  }

  onAction(root, {
    period: (el) => {
      period = el.dataset.period as Period;
      paint();
    },
  });
  root.addEventListener("submit", (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>("[data-range]");
    if (!form) return;
    e.preventDefault();
    const f = new FormData(form);
    const a = String(f.get("from"));
    const b = String(f.get("to"));
    if (!a || !b) return toast("Elige las dos fechas", "error");
    if (a > b) return toast("La fecha inicial debe ser anterior a la final", "error");
    if (daysBetween(a, b) > MAX_RANGE_DAYS) return toast(`El rango máximo es de ${MAX_RANGE_DAYS} días`, "error");
    from = a;
    to = b;
    paint();
  });

  store.subscribe(paint);
  paint();
}
