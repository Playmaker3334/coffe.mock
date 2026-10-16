import { looseLines, paymentLabel } from "./logic";
import type { AppState, Order } from "./types";
import { esc, fmtTime } from "./ui";

const EXTRAS_PER_LABEL = 6;

export function comandaLabels(o: Order, s: AppState): string[] {
  const c = s.customers.find((x) => x.phone === o.phone);
  const who = o.phone === "0" ? o.guestName || "Mostrador" : c?.name ?? o.phone;
  const head = [
    `<b>${esc(who)}</b>${o.phone !== "0" ? ` · ${esc(o.phone)}` : ""}`,
    c?.type === "empleado" ? `EMPLEADO · ${esc(c.company.toUpperCase())}` : "",
    `<b>#${o.id}</b>`,
  ];
  const foot = [
    o.address ? esc(o.address) : "",
    o.notes.length ? `NOTA: ${esc(o.notes.map((n) => n.text).join(" / "))}` : "",
    `** ${esc(paymentLabel(o).toUpperCase())} ** $${o.total}`,
    `${o.type === "domicilio" ? "DOMICILIO" : o.type === "recoger" ? "RECOGER" : "MOSTRADOR"} ${esc(o.slot) || fmtTime(o.createdAt)}`,
  ];
  const loose = looseLines(o).map((l) => `${l.qty}x ${l.name}${l.size === "grande" ? " (G)" : ""}`);
  const bodies = [
    ...o.combos.map((cb, i) => [`COMBO ${i + 1}/${o.combos.length} · ${esc(cb.name)}`, ...cb.items.map((it) => `· ${esc(it.name)}`)]),
    ...Array.from({ length: Math.ceil(loose.length / EXTRAS_PER_LABEL) }, (_, i) => [
      o.combos.length ? "EXTRAS" : "PEDIDO",
      ...loose.slice(i * EXTRAS_PER_LABEL, (i + 1) * EXTRAS_PER_LABEL).map(esc),
    ]),
  ];
  return bodies.map((body) => [...head, ...body, ...foot].filter(Boolean).join("<br>"));
}

export function printComanda(o: Order, s: AppState): void {
  const w = window.open("", "_blank", "width=420,height=600");
  if (!w) return;
  const labels = comandaLabels(o, s).map((l) => `<section>${l}</section>`).join("");
  w.document.write(`<!doctype html><title>Comanda #${o.id}</title><style>
    @page { size: 3in 2in; margin: 0.1in }
    body { font: 11px/1.25 ui-monospace, monospace; margin: 0 }
    section { width: 2.8in; min-height: 1.8in; padding: 0.05in; border-bottom: 1px dashed #000; page-break-after: always }
  </style>${labels}<script>print()<\/script>`);
  w.document.close();
}
