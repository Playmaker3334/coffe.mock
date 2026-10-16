import { upsertUser } from "../actions-gestion";
import { NAV } from "../nav";
import { session, store } from "../store";
import type { Access, ModuleId, User } from "../types";
import { $, cls, html, onAction, openDialog, raw, render, toast } from "../ui";

const GROUPS = NAV.map((g) => ({ group: g.group, items: g.items.filter((i) => i.id !== "usuarios") as { id: ModuleId; label: string }[] })).filter((g) => g.items.length);
const LEVELS: [Access | "", string][] = [["", "Sin acceso"], ["read", "Ver"], ["write", "Editar"]];

export function mountUsuarios(): void {
  const me = session.user();
  if (!me?.isAdmin) return;
  const root = $("[data-view]");

  function summary(u: User) {
    if (u.isAdmin) return "Acceso total";
    const mods = GROUPS.flatMap((g) => g.items).filter((i) => u.permissions[i.id]);
    return mods.length ? mods.map((i) => `${i.label}${u.permissions[i.id] === "write" ? "" : " (ver)"}`).join(" · ") : "Sin módulos asignados";
  }

  function paint() {
    const users = store.get().users;
    render(root, html`
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p class="max-w-2xl text-ink/80">Cada módulo se asigna como <b>Ver</b> o <b>Editar</b>. Así, Caja puede hacer el corte sin ver el efectivo esperado (corte ciego).</p>
        <button type="button" data-action="new" class="${cls.btn.sun}">Nuevo usuario</button>
      </div>
      <ul class="grid gap-4 md:grid-cols-2">
        ${users.map((u) => html`
          <li class="${cls.card} flex flex-col p-4 ${u.active ? "" : "opacity-60"}">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="${cls.kicker}">${u.isAdmin ? "Administración" : u.role}</p>
                <p class="font-display text-[1.8rem] uppercase leading-none">${u.name}${u.id === me!.id ? html` <span class="align-middle font-body text-sm normal-case text-ink/70">(tú)</span>` : ""}</p>
              </div>
              <span class="${u.active ? "bg-leaf text-cream" : "bg-stone text-ink"} px-2 py-0.5 text-sm font-bold">${u.active ? "Activo" : "Inactivo"}</span>
            </div>
            <p class="mt-3 text-sm leading-relaxed text-ink/85">${summary(u)}</p>
            <button type="button" data-action="edit" data-id="${u.id}" class="${cls.btn.ghost} mt-4 self-start">Editar permisos</button>
          </li>`)}
      </ul>`);
  }

  function edit(existing: User | null) {
    const u: User = existing ?? { id: `u-${Date.now().toString(36)}`, name: "", role: "", isAdmin: false, active: true, permissions: {} };
    openDialog({
      title: existing ? `Editar · ${u.name}` : "Nuevo usuario",
      submit: "Guardar",
      wide: true,
      body: html`
        <div class="grid gap-3 sm:grid-cols-2">
          <label><span class="${cls.label}">Nombre *</span><input name="name" value="${u.name}" maxlength="60" class="${cls.input}"></label>
          <label><span class="${cls.label}">Puesto</span><input name="role" value="${u.role}" maxlength="60" placeholder="Caja, Barra, Gerente…" class="${cls.input}"></label>
          <label class="flex min-h-11 items-center gap-3"><input type="checkbox" name="active" class="size-5 accent-[var(--color-leaf)]" ${u.active ? raw("checked") : ""}><span class="font-bold">Activo</span></label>
          <label class="flex min-h-11 items-center gap-3"><input type="checkbox" name="isAdmin" data-admin class="size-5 accent-[var(--color-leaf)]" ${u.isAdmin ? raw("checked") : ""}><span class="font-bold">Administrador (acceso total)</span></label>
        </div>
        <fieldset data-matrix class="mt-5" ${u.isAdmin ? raw("disabled") : ""}>
          <legend class="${cls.label}">Permisos por módulo</legend>
          <p data-admin-note class="mb-2 text-sm text-ink/75" ${u.isAdmin ? "" : raw("hidden")}>Un administrador ve y edita todo, incluidos usuarios.</p>
          <div class="grid gap-4 sm:grid-cols-2">
            ${GROUPS.map((g) => html`
              <div>
                <p class="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.22em] text-caramel">${g.group}</p>
                ${g.items.map((i) => html`
                  <label class="flex min-h-11 items-center justify-between gap-3 border-b border-dashed border-ink/30">
                    <span class="font-bold">${i.label}</span>
                    <select name="perm-${i.id}" class="min-h-11 border-2 border-ink bg-cream px-2 font-body focus:outline-none focus-visible:ring-3 focus-visible:ring-sun">
                      ${LEVELS.map(([v, label]) => html`<option value="${v}" ${(u.permissions[i.id] ?? "") === v ? raw("selected") : ""}>${label}</option>`)}
                    </select>
                  </label>`)}
              </div>`)}
          </div>
        </fieldset>`,
      onInput: (form, e) => {
        if (!(e.target as HTMLElement).matches("[data-admin]")) return;
        const admin = (e.target as HTMLInputElement).checked;
        form.querySelector<HTMLFieldSetElement>("[data-matrix]")!.disabled = admin;
        form.querySelector<HTMLElement>("[data-admin-note]")!.hidden = !admin;
      },
      onSubmit: (f) => {
        const permissions = Object.fromEntries(
          GROUPS.flatMap((g) => g.items).map((i) => [i.id, String(f.get(`perm-${i.id}`) ?? "")] as const).filter(([, v]) => v),
        ) as User["permissions"];
        const isAdmin = f.get("isAdmin") === "on";
        const res = upsertUser(store.get(), {
          ...u,
          name: String(f.get("name") ?? ""),
          role: String(f.get("role") ?? "") || (isAdmin ? "Administración" : ""),
          active: f.get("active") === "on",
          isAdmin,
          permissions: isAdmin ? {} : permissions,
        });
        if (!res.ok) return res.error;
        store.set(res.state);
        toast(existing ? "Permisos actualizados" : "Usuario creado");
      },
    });
  }

  onAction(root, {
    new: () => edit(null),
    edit: (el) => edit(store.get().users.find((u) => u.id === el.dataset.id) ?? null),
  });
  store.subscribe(paint);
  paint();
}
