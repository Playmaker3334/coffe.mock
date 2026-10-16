import { savePromotion, slugify } from "../actions-catalogo";
import { canWrite, comboChecker, groupOf } from "../logic";
import { session, store } from "../store";
import type { ComboGroup, OrderLine, Promotion } from "../types";
import { $, cls, html, money, onAction, openDialog, raw, render, toast } from "../ui";

const GROUPS: { id: ComboGroup; label: string }[] = [
  { id: "bebida", label: "Bebida" },
  { id: "pan", label: "Pan" },
  { id: "plato", label: "Plato" },
];
const MAX_PER_GROUP = 3;

const slotsText = (slots: ComboGroup[]) =>
  GROUPS.map((g) => [g.label, slots.filter((x) => x === g.id).length] as const)
    .filter(([, n]) => n)
    .map(([label, n]) => (n > 1 ? `${n} × ${label}` : label))
    .join(" + ");

export function mountCombos(): void {
  const user = session.user();
  if (!user) return;
  const writable = canWrite(user, "promociones");
  const root = $("[data-view]");
  let tester: OrderLine[] = [];

  function card(p: Promotion) {
    return html`
      <article class="${cls.card} flex flex-col p-4 ${p.active ? "" : "opacity-60"}">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="${cls.kicker}">${p.active ? "Activo" : "Inactivo"}</p>
            <h2 class="${cls.heading}">${p.name}</h2>
          </div>
          <p class="font-display text-[2rem] leading-none tabular-nums">${money(p.price)}</p>
        </div>
        <p class="mt-2 font-bold">${slotsText(p.slots)}</p>
        <p class="mt-1 text-sm ${p.employeeBenefit ? "text-henequen" : "text-ink/70"}">
          ${p.employeeBenefit ? `Beneficio empleado: ${money(p.employeePrice)} (o $0 con cortesía)` : "Sin beneficio de empleado"}
        </p>
        ${writable ? html`<button type="button" data-action="edit" data-id="${p.id}" class="${cls.btn.ghost} mt-4 self-start">Editar</button>` : ""}
      </article>`;
  }

  function testerView() {
    const s = store.get();
    const eligible = s.products.filter((p) => p.active && p.promo && groupOf(p.category) && p.sizes.some((z) => z.id === "chico" && z.active));
    const { combos, total } = comboChecker(tester, s.products, s.promotions);
    const subtotal = tester.reduce((sum, l) => sum + l.qty * l.price, 0);
    return html`
      <section class="${cls.card} mt-8 p-4" aria-labelledby="probador">
        <h2 id="probador" class="${cls.heading}">Probador de combos</h2>
        <p class="mt-1 text-ink/80">Agrega piezas (tamaño chico) y mira qué combos aplicaría la caja. Prueba todos los órdenes posibles y se queda con el más barato.</p>
        <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div class="flex flex-wrap content-start gap-2">
            ${eligible.map((p) => html`
              <button type="button" data-action="test-add" data-id="${p.id}" class="min-h-11 cursor-pointer border-2 border-ink bg-cream px-3 text-sm font-bold hover:bg-sun-soft focus-visible:outline-3 focus-visible:outline-ink">
                ${p.name} <span class="tabular-nums text-ink/70">${money(p.sizes.find((z) => z.id === "chico")!.price)}</span>
              </button>`)}
          </div>
          <div class="border-2 border-dashed border-ink/40 p-3">
            ${tester.length ? html`
              <ul class="flex flex-col gap-1">
                ${tester.map((l, i) => html`<li class="flex items-center justify-between gap-2"><span>${l.qty}× ${l.name}</span>
                  <button type="button" data-action="test-remove" data-i="${i}" class="min-h-11 px-2 text-sm font-bold underline" aria-label="Quitar ${l.name}">Quitar</button></li>`)}
              </ul>
              <div class="mt-3 border-t-2 border-dashed border-ink/40 pt-3">
                ${combos.length ? combos.map((c) => html`<p class="text-sm"><b>${c.name}</b> ${money(c.price)} · ${c.items.map((i) => i.name).join(" + ")}</p>`) : html`<p class="text-sm">Ningún combo aplica.</p>`}
                <p class="mt-2 flex justify-between"><span>Sin combos</span><span class="tabular-nums">${money(subtotal)}</span></p>
                <p class="flex justify-between font-display text-2xl"><span>Con combos</span><span class="tabular-nums">${money(total)}</span></p>
                ${subtotal > total ? html`<p class="mt-1 bg-leaf px-2 py-0.5 text-center font-bold text-cream">Ahorro ${money(subtotal - total)}</p>` : ""}
              </div>
              <button type="button" data-action="test-clear" class="${cls.btn.ghost} mt-3 w-full">Vaciar</button>` : html`<p class="text-ink/75">Toca productos para probar.</p>`}
          </div>
        </div>
      </section>`;
  }

  function paint() {
    const s = store.get();
    const active = s.promotions.filter((p) => p.active).length;
    render(root, html`
      <div class="mb-5 flex flex-wrap items-center gap-3">
        <p class="text-lg"><b class="tabular-nums">${active}</b> de 6 combos activos. Solo entran piezas de tamaño chico marcadas “Entra en combos”.</p>
        ${writable ? html`<button type="button" data-action="new" class="${cls.btn.sun} ml-auto">Nuevo combo</button>` : ""}
      </div>
      <div class="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">${s.promotions.map(card)}</div>
      ${testerView()}
      ${writable ? "" : html`<p class="mt-3 text-sm font-bold text-chili">Tu usuario solo puede consultar los combos.</p>`}`);
  }

  function edit(p: Promotion | null) {
    const isNew = !p;
    const base: Promotion = p ?? { id: "", name: "", price: 0, slots: ["bebida", "pan"], employeeBenefit: false, employeePrice: 0, active: true };
    openDialog({
      title: isNew ? "Nuevo combo" : `Editar · ${base.name}`,
      submit: isNew ? "Crear combo" : "Guardar",
      body: html`
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="sm:col-span-2"><span class="${cls.label}">Nombre *</span><input name="name" required maxlength="60" value="${base.name}" class="${cls.input}"></label>
          <label><span class="${cls.label}">Precio fijo del combo</span><input name="price" type="number" inputmode="decimal" min="1" step="1" value="${base.price || ""}" class="${cls.input} tabular-nums"></label>
          <label class="flex min-h-11 items-center gap-2 self-end"><input type="checkbox" name="active" class="size-5 accent-[var(--color-ink)]" ${base.active ? raw("checked") : ""}> Activo</label>
          <fieldset class="grid grid-cols-3 gap-2 border-2 border-ink/30 p-3 sm:col-span-2">
            <legend class="${cls.label} px-1">Piezas del combo (mínimo 2)</legend>
            ${GROUPS.map((g) => html`
              <label><span class="${cls.label}">${g.label}</span>
                <input name="slot-${g.id}" type="number" inputmode="numeric" min="0" max="${MAX_PER_GROUP}" step="1" value="${base.slots.filter((x) => x === g.id).length}" class="${cls.input} tabular-nums"></label>`)}
          </fieldset>
          <label class="flex min-h-11 items-center gap-2"><input type="checkbox" name="employeeBenefit" class="size-5 accent-[var(--color-leaf)]" ${base.employeeBenefit ? raw("checked") : ""}> Beneficio de empleado</label>
          <label><span class="${cls.label}">Precio para empleado</span><input name="employeePrice" type="number" inputmode="decimal" min="0" step="1" value="${base.employeePrice}" class="${cls.input} tabular-nums"></label>
        </div>
        <p class="mt-3 text-sm text-ink/80">Empleados con “descuento” pagan el precio de empleado; con “cortesía” pagan $0, hasta su tope diario.</p>`,
      onSubmit: (f) => {
        const name = String(f.get("name") ?? "");
        const slots = GROUPS.flatMap((g) => Array.from({ length: Math.min(MAX_PER_GROUP, Math.max(0, Math.floor(Number(f.get(`slot-${g.id}`)) || 0))) }, () => g.id));
        const next: Promotion = {
          ...base,
          id: isNew ? slugify(name) : base.id,
          name,
          price: Number(f.get("price") || 0),
          slots,
          active: f.get("active") === "on",
          employeeBenefit: f.get("employeeBenefit") === "on",
          employeePrice: Number(f.get("employeePrice") || 0),
        };
        const res = savePromotion(store.get(), next, isNew);
        if (!res.ok) return res.error;
        store.set(res.state);
        toast("Combo guardado");
      },
    });
  }

  onAction(root, {
    new: () => edit(null),
    edit: (el) => edit(store.get().promotions.find((p) => p.id === el.dataset.id) ?? null),
    "test-add": (el) => {
      const p = store.get().products.find((x) => x.id === el.dataset.id)!;
      const price = p.sizes.find((z) => z.id === "chico")!.price;
      const i = tester.findIndex((l) => l.productId === p.id);
      tester = i >= 0 ? tester.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l)) : [...tester, { productId: p.id, size: "chico", qty: 1, price, name: p.name }];
      paint();
    },
    "test-remove": (el) => {
      const i = Number(el.dataset.i);
      tester = tester.map((l, j) => (j === i ? { ...l, qty: l.qty - 1 } : l)).filter((l) => l.qty > 0);
      paint();
    },
    "test-clear": () => {
      tester = [];
      paint();
    },
  });

  store.subscribe(paint);
  paint();
}
