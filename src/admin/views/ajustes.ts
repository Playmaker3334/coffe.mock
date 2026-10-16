import { generateSlots, saveSettings } from "../actions-gestion";
import { canWrite } from "../logic";
import { session, store } from "../store";
import type { Settings } from "../types";
import { $, cls, confirmDialog, html, onAction, openDialog, raw, render, toast } from "../ui";

const UNLIMITED = 999;

export function mountAjustes(): void {
  const user = session.user();
  if (!user) return;
  const writable = canWrite(user, "ajustes");
  const root = $("[data-view]");
  let draft: Settings = structuredClone(store.get().settings);
  let dirty = false;
  const off = writable ? "" : raw("disabled");

  const setDraft = (next: Settings, repaint = true) => {
    draft = next;
    dirty = true;
    if (repaint) return paint();
    root.querySelector<HTMLElement>("[data-dirty]")?.removeAttribute("hidden");
    root.querySelector<HTMLButtonElement>("[data-action=discard]")?.removeAttribute("disabled");
  };

  function paint() {
    render(root, html`
      <form data-settings class="flex max-w-4xl flex-col gap-6">
        <section class="${cls.card} p-5">
          <h2 class="${cls.heading} text-[1.4rem]">Horario y caja</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <label><span class="${cls.label}">Recibe pedidos desde</span><input type="time" data-f="orderStart" value="${draft.orderStart}" class="${cls.input}" ${off}></label>
            <label><span class="${cls.label}">Hasta</span><input type="time" data-f="orderEnd" value="${draft.orderEnd}" class="${cls.input}" ${off}></label>
            <label><span class="${cls.label}">Fondo de caja</span><input type="number" data-f="cashFloat" min="0" step="50" value="${draft.cashFloat}" class="${cls.input} tabular-nums" ${off}></label>
          </div>
          <label class="mt-4 flex min-h-11 items-center gap-3">
            <input type="checkbox" data-f="deliveryEnabled" class="size-5 accent-[var(--color-leaf)]" ${draft.deliveryEnabled ? raw("checked") : ""} ${off}>
            <span class="font-bold">Servicio a domicilio activo</span>
          </label>
          <p class="mt-1 text-sm text-ink/75">El fondo es lo que queda en caja al cerrar; el corte lo descuenta del efectivo contado.</p>
        </section>

        <section class="${cls.card} p-5">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="${cls.heading} text-[1.4rem]">Horarios de entrega</h2>
              <p class="text-sm text-ink/75">Cupo por horario. Recoger en ${UNLIMITED} = sin límite.</p>
            </div>
            ${writable ? html`
              <div class="flex flex-wrap gap-2">
                <button type="button" data-action="generate" class="${cls.btn.ghost}">Generar horarios</button>
                <button type="button" data-action="copy" class="${cls.btn.ghost}" ${draft.slots.length > 1 ? "" : raw("disabled")}>Copiar cupo de la 1.ª fila</button>
              </div>` : ""}
          </div>
          <div class="relative mt-4 overflow-x-auto">
            <table class="w-full min-w-[30rem] text-left">
              <thead class="text-[0.78rem] font-bold uppercase tracking-[0.14em] text-ink/80"><tr><th class="pb-2">Hora</th><th class="pb-2">Cupo domicilio</th><th class="pb-2">Cupo recoger</th><th class="pb-2"><span class="sr-only">Quitar</span></th></tr></thead>
              <tbody>
                ${draft.slots.map((sl, i) => html`
                  <tr>
                    <td class="py-1 pr-2"><input type="time" data-slot="${i}" data-k="time" value="${sl.time}" aria-label="Hora del horario ${i + 1}" class="${cls.input}" ${off}></td>
                    <td class="py-1 pr-2"><input type="number" min="0" step="1" data-slot="${i}" data-k="deliveryLimit" value="${sl.deliveryLimit}" aria-label="Cupo domicilio ${sl.time}" class="${cls.input} tabular-nums" ${off}></td>
                    <td class="py-1 pr-2"><input type="number" min="0" step="1" data-slot="${i}" data-k="pickupLimit" value="${sl.pickupLimit}" aria-label="Cupo recoger ${sl.time}" class="${cls.input} tabular-nums" ${off}></td>
                    <td class="py-1">${writable ? html`<button type="button" data-action="remove" data-i="${i}" class="${cls.btn.ghost} min-w-11 px-0" aria-label="Quitar horario ${sl.time}">✕</button>` : ""}</td>
                  </tr>`)}
              </tbody>
            </table>
            ${draft.slots.length ? "" : html`<p class="py-4 text-ink/75">Sin horarios: la tienda ofrece «Lo antes posible».</p>`}
          </div>
          ${writable ? html`<button type="button" data-action="add" class="${cls.btn.ghost} mt-3">Agregar horario</button>` : ""}
        </section>

        ${writable ? html`
          <div class="flex flex-wrap items-center gap-3">
            <button type="submit" class="${cls.btn.ink}">Guardar ajustes</button>
            <button type="button" data-action="discard" class="${cls.btn.ghost}" ${dirty ? "" : raw("disabled")}>Descartar cambios</button>
            <span data-dirty class="font-bold text-caramel" ${dirty ? "" : raw("hidden")}>Cambios sin guardar</span>
          </div>` : html`<p class="font-bold text-chili">Tu usuario solo puede consultar los ajustes.</p>`}

        ${user!.isAdmin ? html`
          <section class="border-2 border-chili bg-paper p-5">
            <h2 class="${cls.heading} text-[1.4rem] text-chili">Datos del demo</h2>
            <p class="mt-1">Borra ventas, clientes y cambios, y vuelve a los datos de ejemplo. Útil antes de presentar.</p>
            <button type="button" data-action="reset" class="${cls.btn.danger} mt-3">Reiniciar datos del demo</button>
          </section>` : ""}
      </form>`);
  }

  function generate() {
    openDialog({
      title: "Generar horarios",
      submit: "Reemplazar horarios",
      body: html`
        <div class="grid gap-3 sm:grid-cols-3">
          <label><span class="${cls.label}">Desde</span><input name="from" type="time" value="08:00" class="${cls.input}"></label>
          <label><span class="${cls.label}">Hasta</span><input name="to" type="time" value="11:00" class="${cls.input}"></label>
          <label><span class="${cls.label}">Cada (min)</span><input name="every" type="number" min="5" step="5" value="30" class="${cls.input} tabular-nums"></label>
          <label><span class="${cls.label}">Cupo domicilio</span><input name="delivery" type="number" min="0" value="4" class="${cls.input} tabular-nums"></label>
          <label><span class="${cls.label}">Cupo recoger</span><input name="pickup" type="number" min="0" value="${UNLIMITED}" class="${cls.input} tabular-nums"></label>
        </div>
        <p class="mt-3 text-sm text-ink/75">Reemplaza la lista actual. Revisa y guarda después.</p>`,
      onSubmit: (f) => {
        const slots = generateSlots(String(f.get("from")), String(f.get("to")), Number(f.get("every")), Number(f.get("delivery")), Number(f.get("pickup")));
        if (typeof slots === "string") return slots;
        setDraft({ ...draft, slots });
      },
    });
  }

  onAction(root, {
    add: () => setDraft({ ...draft, slots: [...draft.slots, { time: "", deliveryLimit: 4, pickupLimit: UNLIMITED }] }),
    remove: (el) => setDraft({ ...draft, slots: draft.slots.filter((_, i) => i !== Number(el.dataset.i)) }),
    copy: () => {
      const [first] = draft.slots;
      setDraft({ ...draft, slots: draft.slots.map((sl) => ({ ...sl, deliveryLimit: first.deliveryLimit, pickupLimit: first.pickupLimit })) });
    },
    generate,
    discard: () => {
      draft = structuredClone(store.get().settings);
      dirty = false;
      paint();
    },
    reset: () =>
      confirmDialog("Reiniciar demo", "Se borran todas las ventas, clientes, cupones y cambios de este navegador.", "Borrar y reiniciar", () => {
        store.reset();
        draft = structuredClone(store.get().settings);
        dirty = false;
        paint();
        toast("Demo reiniciado");
      }),
  });

  root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.f) {
      const k = t.dataset.f as keyof Settings;
      const v = k === "deliveryEnabled" ? t.checked : k === "cashFloat" ? Number(t.value) : t.value;
      setDraft({ ...draft, [k]: v }, false);
    } else if (t.dataset.slot) {
      const i = Number(t.dataset.slot);
      const k = t.dataset.k as "time" | "deliveryLimit" | "pickupLimit";
      setDraft({ ...draft, slots: draft.slots.map((sl, j) => (j === i ? { ...sl, [k]: k === "time" ? t.value : Number(t.value) } : sl)) }, false);
    }
  });
  root.addEventListener("change", (e) => {
    if ((e.target as HTMLInputElement).type === "checkbox") paint();
  });
  root.addEventListener("submit", (e) => {
    e.preventDefault();
    const res = saveSettings(store.get(), draft);
    if (!res.ok) return toast(res.error, "error");
    store.set(res.state);
    draft = structuredClone(res.state.settings);
    dirty = false;
    paint();
    toast("Ajustes guardados");
  });

  store.subscribe(() => {
    if (dirty) return;
    draft = structuredClone(store.get().settings);
    paint();
  });
  paint();
}
