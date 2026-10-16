import { registerCount, setCashFloat } from "../actions-caja";
import { canRead, canWrite, countTotal, DENOMINATIONS, expectedForDay, round2, today } from "../logic";
import { session, store } from "../store";
import type { CashCount } from "../types";
import { $, cls, fmtDate, fmtTime, html, money, onAction, render, toast } from "../ui";

type Step = "captura" | "revision" | "veredicto";
const COINS_FROM = 10;
const TOLERANCE = 0.005;

export function mountCorte(): void {
  const user = session.user();
  if (!user) return;
  const writable = canWrite(user, "corte");
  const manager = user.isAdmin || canRead(user, "cierre") || canRead(user, "ventas");
  const canEditFloat = user.isAdmin || canWrite(user, "ajustes");
  const root = $("[data-corte]");

  let step: Step = "captura";
  let pieces: Record<string, number> = {};
  let nonCash = 0;
  let result: CashCount | null = null;

  const todayCounts = () => store.get().counts.filter((c) => c.day === today());
  const denLabel = (v: number) => `${v < 1 ? "50¢" : money(v)} ${v >= COINS_FROM * 2 ? "billete" : "moneda"}`;

  function captura() {
    return html`
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        ${DENOMINATIONS.map((v) => {
          const k = String(v);
          return html`
            <div class="${cls.card} flex items-center gap-3 p-3">
              <label for="den-${k.replace(".", "_")}" class="min-w-0 flex-1 font-bold">${denLabel(v)}</label>
              <div class="flex items-center border-2 border-ink">
                <button type="button" data-action="step" data-den="${k}" data-d="-1" class="grid size-11 cursor-pointer place-items-center text-xl font-bold hover:bg-sand" aria-label="Quitar una pieza de ${money(v)}">−</button>
                <input id="den-${k.replace(".", "_")}" data-den-input="${k}" type="number" inputmode="numeric" min="0" step="1" value="${pieces[k] ?? 0}" class="h-11 w-16 border-x-2 border-ink bg-cream text-center font-bold tabular-nums focus:outline-none focus-visible:ring-3 focus-visible:ring-sun">
                <button type="button" data-action="step" data-den="${k}" data-d="1" class="grid size-11 cursor-pointer place-items-center text-xl font-bold hover:bg-sand" aria-label="Agregar una pieza de ${money(v)}">+</button>
              </div>
            </div>`;
        })}
      </div>
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <div class="${cls.card} p-4">
          <p class="${cls.kicker}">Efectivo contado</p>
          <p data-counted class="font-display text-[2.4rem] leading-none tabular-nums">${money(countTotal(pieces))}</p>
        </div>
        <label class="${cls.card} block p-4"><span class="${cls.label}">Transferencias, tarjeta y terminal (total)</span>
          <input data-noncash type="number" inputmode="decimal" min="0" step="0.5" value="${nonCash}" class="${cls.input} text-2xl tabular-nums"></label>
      </div>
      <div class="mt-5 flex flex-wrap gap-3">
        <button type="button" data-action="clear" class="${cls.btn.ghost}">Borrar conteo</button>
        <button type="button" data-action="review" class="${cls.btn.sun} text-[1.3rem]">Revisar conteo</button>
      </div>`;
  }

  function revision() {
    const rows = DENOMINATIONS.filter((v) => (pieces[String(v)] ?? 0) > 0);
    return html`
      <div class="${cls.card} max-w-2xl p-5">
        <h2 class="${cls.heading}">Revisa antes de registrar</h2>
        <p class="mt-1 text-ink/80">Confirma que lo capturado es lo que tienes en la mano.</p>
        <table class="mt-4 w-full">
          <thead><tr class="border-b-2 border-ink text-left text-sm uppercase tracking-wider"><th class="py-2">Denominación</th><th class="text-right">Piezas</th><th class="text-right">Importe</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map((v) => html`<tr class="border-b border-dashed border-ink/30"><td class="py-2">${denLabel(v)}</td><td class="text-right tabular-nums">${pieces[String(v)]}</td><td class="text-right tabular-nums">${money(v * pieces[String(v)])}</td></tr>`) : html`<tr><td colspan="3" class="py-3 text-ink/75">Sin efectivo capturado.</td></tr>`}
          </tbody>
          <tfoot class="font-bold">
            <tr><td class="pt-3">Efectivo contado</td><td></td><td class="pt-3 text-right font-display text-2xl tabular-nums">${money(countTotal(pieces))}</td></tr>
            <tr><td>No efectivo</td><td></td><td class="text-right tabular-nums">${money(nonCash)}</td></tr>
          </tfoot>
        </table>
        <div class="mt-5 flex flex-wrap gap-3">
          <button type="button" data-action="back" class="${cls.btn.ghost}">Corregir</button>
          <button type="button" data-action="register" class="${cls.btn.leaf}" ${writable ? "" : "disabled"}>Registrar conteo</button>
        </div>
      </div>`;
  }

  function veredicto() {
    const r = result!;
    const n = todayCounts().findIndex((c) => c.id === r.id) + 1;
    const missingCash = round2(r.expectedCash - r.counted);
    const missingNon = round2(r.expectedNonCash - r.nonCash);
    const faltas = [
      missingCash > TOLERANCE ? `Faltan ${money(missingCash)} en efectivo` : "",
      missingNon > TOLERANCE ? `Faltan ${money(missingNon)} en no efectivo` : "",
    ].filter(Boolean);
    return html`
      <div class="${cls.card} max-w-2xl p-5" role="status">
        <p class="${cls.kicker}">Conteo #${n} registrado · ${fmtTime(r.at)}</p>
        ${faltas.length ? html`
          <div class="mt-3 border-2 border-chili bg-paper p-4">
            <p class="font-display text-[1.8rem] uppercase leading-none text-chili">⚠ Hay faltante</p>
            ${faltas.map((f) => html`<p class="mt-2 text-xl font-bold">${f}</p>`)}
            <p class="mt-3 text-ink/80">Vuelve a contar. Si el faltante sigue, avisa a administración.</p>
          </div>` : html`
          <div class="mt-3 border-2 border-leaf bg-paper p-4">
            <p class="font-display text-[1.8rem] uppercase leading-none text-henequen">✓ Corte cuadrado</p>
            <p class="mt-2 text-xl">Retira <b class="tabular-nums">${money(Math.max(0, r.counted - r.float))}</b> y deja <b class="tabular-nums">${money(r.float)}</b> de fondo.</p>
          </div>`}
        <div class="mt-5 flex flex-wrap gap-3">
          <button type="button" data-action="again" class="${cls.btn.ink}">Volver a contar</button>
        </div>
      </div>`;
  }

  function managerPanel() {
    const s = store.get();
    const exp = expectedForDay(s, today());
    const history = [...s.counts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
    const diff = (d: number) => {
      const v = round2(d);
      if (Math.abs(v) <= TOLERANCE) return html`<span class="font-bold text-henequen">✓ Cuadra</span>`;
      return v < 0 ? html`<span class="font-bold text-chili tabular-nums">Faltan ${money(-v)}</span>` : html`<span class="font-bold text-caramel tabular-nums">Sobran ${money(v)}</span>`;
    };
    return html`
      <section aria-labelledby="corte-admin" class="mt-10">
        <h2 id="corte-admin" class="${cls.heading} text-[1.9rem]">Vista de administración</h2>
        <p class="mt-1 text-ink/80">Solo administración y gerencia ven el esperado. El cajero solo ve sus faltantes.</p>
        <div class="mt-4 grid gap-4 md:grid-cols-3">
          <div class="${cls.card} p-4"><p class="${cls.kicker}">Esperado en efectivo hoy</p><p class="font-display text-[2rem] tabular-nums">${money(exp.cash)}</p><p class="text-sm text-ink/75">Incluye fondo de ${money(s.settings.cashFloat)}</p></div>
          <div class="${cls.card} p-4"><p class="${cls.kicker}">Esperado no efectivo hoy</p><p class="font-display text-[2rem] tabular-nums">${money(exp.nonCash)}</p></div>
          <form data-float-form class="${cls.card} p-4">
            <label><span class="${cls.label}">Fondo de caja</span>
              <input name="float" type="number" inputmode="decimal" min="0" step="50" value="${s.settings.cashFloat}" class="${cls.input} tabular-nums" ${canEditFloat ? "" : "disabled"}></label>
            ${canEditFloat ? html`<button class="${cls.btn.ink} mt-2 w-full">Guardar fondo</button>` : html`<p class="mt-2 text-sm text-ink/75">Solo administración cambia el fondo.</p>`}
          </form>
        </div>
        <div class="${cls.card} mt-5 overflow-x-auto">
          <table class="w-full min-w-[46rem] text-left">
            <caption class="sr-only">Historial de conteos</caption>
            <thead class="border-b-2 border-ink text-sm uppercase tracking-wider">
              <tr><th class="p-3">Fecha</th><th>Quién</th><th class="text-right">Esperado</th><th class="text-right">Contado</th><th class="pl-4">Efectivo</th><th class="text-right">No efectivo</th><th class="pl-4 pr-3">Dif. no efectivo</th></tr>
            </thead>
            <tbody>
              ${history.length ? history.map((c) => html`
                <tr class="border-b border-dashed border-ink/30">
                  <td class="p-3">${fmtDate(c.at)} · ${fmtTime(c.at)}${c.day === today() ? html` <span class="bg-sun px-1 text-xs font-bold uppercase">Hoy</span>` : ""}</td>
                  <td>${c.by}</td>
                  <td class="text-right tabular-nums">${money(c.expectedCash)}</td>
                  <td class="text-right tabular-nums">${money(c.counted)}</td>
                  <td class="pl-4">${diff(c.counted - c.expectedCash)}</td>
                  <td class="text-right tabular-nums">${money(c.nonCash)}</td>
                  <td class="pl-4 pr-3">${diff(c.nonCash - c.expectedNonCash)}</td>
                </tr>`) : html`<tr><td colspan="7" class="p-4 text-ink/75">Aún no hay conteos.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function paint() {
    const counts = todayCounts();
    const last = counts.at(-1);
    render(root, html`
      <p class="mb-5 inline-block border-2 border-ink bg-paper px-3 py-2 font-bold">
        Intentos de hoy: <span class="tabular-nums">${counts.length}</span>${last ? ` · último a las ${fmtTime(last.at)}` : ""}
      </p>
      ${writable ? "" : html`<p class="mb-4 font-bold text-chili">Tu usuario solo puede consultar el corte.</p>`}
      ${step === "captura" ? captura() : step === "revision" ? revision() : veredicto()}
      ${manager ? managerPanel() : ""}`);
  }

  const syncTotal = () => {
    const el = root.querySelector("[data-counted]");
    if (el) el.textContent = money(countTotal(pieces));
  };

  onAction(root, {
    step: (el) => {
      const k = el.dataset.den!;
      pieces = { ...pieces, [k]: Math.max(0, (pieces[k] ?? 0) + Number(el.dataset.d)) };
      const input = root.querySelector<HTMLInputElement>(`[data-den-input="${k}"]`);
      if (input) input.value = String(pieces[k]);
      syncTotal();
    },
    clear: () => {
      pieces = {};
      nonCash = 0;
      paint();
    },
    review: () => {
      step = "revision";
      paint();
    },
    back: () => {
      step = "captura";
      paint();
    },
    register: () => {
      const res = registerCount(store.get(), { denominations: pieces, nonCash, by: user.name });
      if (!res.ok) return toast(res.error, "error");
      result = res.count!;
      step = "veredicto";
      store.set(res.state);
    },
    again: () => {
      pieces = {};
      nonCash = 0;
      result = null;
      step = "captura";
      paint();
    },
  });

  root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.denInput) {
      const v = Math.floor(Number(t.value));
      pieces = { ...pieces, [t.dataset.denInput]: Number.isFinite(v) && v > 0 ? v : 0 };
      syncTotal();
    }
    if (t.matches("[data-noncash]")) nonCash = Math.max(0, Number(t.value) || 0);
  });

  root.addEventListener("submit", (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>("[data-float-form]");
    if (!form) return;
    e.preventDefault();
    const res = setCashFloat(store.get(), Number(new FormData(form).get("float")));
    if (!res.ok) return toast(res.error, "error");
    store.set(res.state);
    toast("Fondo de caja actualizado");
  });

  store.subscribe(paint);
  paint();
}
