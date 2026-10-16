import { money } from "./logic";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

class Raw {
  constructor(readonly value: string) {}
}
export const raw = (value: string): Raw => new Raw(value);

export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  const part = (v: unknown): string =>
    v instanceof Raw ? v.value : Array.isArray(v) ? v.map(part).join("") : v === false || v === null || v === undefined ? "" : esc(v);
  return raw(strings.reduce((out, s, i) => out + s + (i < values.length ? part(values[i]) : ""), ""));
}

export const render = (el: Element, view: Raw): void => {
  el.innerHTML = view.value;
};

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`No existe ${sel}`);
  return el;
};

export function onAction(root: Element, handlers: Record<string, (el: HTMLElement, event: Event) => void>, type = "click"): void {
  root.addEventListener(type, (event) => {
    const el = (event.target as Element).closest<HTMLElement>("[data-action]");
    if (!el || !root.contains(el)) return;
    const handler = handlers[el.dataset.action ?? ""];
    if (handler) handler(el, event);
  });
}

export { money };

const focus = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink";
const btnBase = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-4 font-display text-[1.05rem] uppercase leading-none tracking-wide transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${focus}`;

export const cls = {
  btn: {
    ink: `${btnBase} bg-ink text-cream hover:bg-roast`,
    sun: `${btnBase} bg-sun text-ink hover:bg-ink hover:text-sun`,
    leaf: `${btnBase} bg-leaf text-cream hover:bg-henequen`,
    ghost: `${btnBase} border-2 border-ink bg-paper text-ink hover:bg-sand`,
    danger: `${btnBase} bg-chili text-cream hover:bg-ink`,
  },
  card: "relative border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]",
  input: `min-h-11 w-full border-2 border-ink bg-cream px-3 font-body text-base text-ink placeholder:text-ink/60 focus:bg-paper focus:outline-none focus-visible:ring-3 focus-visible:ring-sun`,
  th: "font-body text-[0.8rem] font-bold uppercase tracking-[0.14em] text-ink",
  label: "mb-1 block font-body text-[0.8rem] font-bold uppercase tracking-[0.14em] text-ink",
  heading: "font-display text-[1.6rem] uppercase leading-none tracking-wide",
  kicker: "font-body text-[0.78rem] font-bold uppercase tracking-[0.2em] text-caramel",
  tab: `min-h-11 cursor-pointer border-2 border-ink px-4 font-body text-sm font-bold uppercase tracking-[0.1em] aria-selected:bg-ink aria-selected:text-sun aria-pressed:bg-ink aria-pressed:text-sun ${focus}`,
  num: "tabular-nums",
};

export const STATUS_TONE: Record<number, string> = {
  0: "bg-sun text-ink",
  1: "bg-orange text-ink",
  2: "bg-teal text-ink",
  3: "bg-leaf text-cream",
  4: "bg-stone text-ink",
  5: "bg-chili text-cream",
};

export function toast(message: string, tone: "ok" | "error" = "ok"): void {
  let region = document.getElementById("toasts");
  if (!region) {
    region = Object.assign(document.createElement("div"), { id: "toasts" });
    region.setAttribute("aria-live", "polite");
    region.className = "pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2 sm:left-auto sm:right-6 sm:items-end";
    document.body.append(region);
  }
  const el = document.createElement("p");
  el.setAttribute("role", tone === "error" ? "alert" : "status");
  el.className = `pointer-events-auto max-w-sm border-2 border-ink px-4 py-3 font-body font-bold shadow-[4px_4px_0_0_var(--color-ink)] ${tone === "error" ? "bg-chili text-cream" : "bg-sun text-ink"}`;
  el.textContent = message;
  region.append(el);
  setTimeout(() => el.remove(), tone === "error" ? 6000 : 3500);
}

export function openDialog(opts: {
  title: string;
  body: Raw;
  submit?: string;
  tone?: keyof typeof cls.btn;
  wide?: boolean;
  onSubmit?: (data: FormData, form: HTMLFormElement) => string | void;
  onInput?: (form: HTMLFormElement, event: Event) => void;
  onReady?: (form: HTMLFormElement) => void;
}): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = `m-auto w-[calc(100%-2rem)] ${opts.wide ? "max-w-3xl" : "max-w-lg"} border-2 border-ink bg-cream p-0 text-ink shadow-[8px_8px_0_0_var(--color-ink)] backdrop:bg-ink/60`;
  dialog.innerHTML = html`
    <form method="dialog" novalidate class="flex max-h-[88dvh] flex-col">
      <header class="flex items-center justify-between gap-4 border-b-2 border-ink bg-sun px-5 py-3">
        <h2 class="${cls.heading}">${opts.title}</h2>
        <button type="button" data-close class="${cls.btn.ghost} min-w-11 px-0" aria-label="Cerrar">✕</button>
      </header>
      <div class="overflow-y-auto px-5 py-4">${opts.body}</div>
      ${opts.onSubmit ? html`
        <footer class="border-t-2 border-ink bg-paper px-5 py-3">
          <p data-dialog-error role="alert" class="mb-2 font-bold text-chili" hidden></p>
          <div class="flex flex-wrap justify-end gap-3">
            <button type="button" data-close class="${cls.btn.ghost}">Cancelar</button>
            <button type="submit" class="${cls.btn[opts.tone ?? "ink"]}">${opts.submit ?? "Guardar"}</button>
          </div>
        </footer>` : ""}
    </form>`.value;
  document.body.append(dialog);
  const form = dialog.querySelector("form")!;
  const error = dialog.querySelector<HTMLElement>("[data-dialog-error]");
  dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("close", () => dialog.remove());
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
  if (opts.onInput) form.addEventListener("input", (e) => opts.onInput!(form, e));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = opts.onSubmit?.(new FormData(form), form);
    if (message && error) {
      error.textContent = message;
      error.hidden = false;
      return;
    }
    dialog.close();
  });
  dialog.showModal();
  opts.onReady?.(form);
  return dialog;
}

export const confirmDialog = (title: string, message: string, submit: string, onYes: () => string | void): void => {
  openDialog({ title, body: html`<p class="text-lg">${message}</p>`, submit, tone: "danger", onSubmit: () => onYes() });
};

export const fmtTime = (iso: string): string =>
  new Intl.DateTimeFormat("es-MX", { timeZone: "America/Merida", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
export const fmtDate = (iso: string): string =>
  new Intl.DateTimeFormat("es-MX", { timeZone: "America/Merida", day: "numeric", month: "short" }).format(new Date(iso));
export const minutesAgo = (iso: string): number => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
