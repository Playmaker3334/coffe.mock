import { createSeed, STATE_VERSION } from "./seed";
import type { AppState, User } from "./types";

const KEY = "cafeteria-admin";
const SESSION_KEY = "cafeteria-admin-sesion";
const EVENT = "admin:change";

function read(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as AppState) : null;
    if (parsed?.version === STATE_VERSION) return parsed;
  } catch {}
  const seed = createSeed();
  write(seed);
  return seed;
}

function write(next: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

let state: AppState | null = null;
const current = (): AppState => (state ??= read());

export const store = {
  get: current,

  set(next: AppState): void {
    state = next;
    write(next);
    window.dispatchEvent(new CustomEvent(EVENT));
  },

  update(fn: (s: AppState) => AppState): void {
    store.set(fn(current()));
  },

  refresh(): void {
    state = read();
  },

  reset(): void {
    store.set(createSeed());
  },

  subscribe(listener: (s: AppState) => void): void {
    window.addEventListener(EVENT, () => listener(current()));
    window.addEventListener("storage", (event) => {
      if (event.key !== KEY) return;
      state = read();
      listener(state);
    });
  },
};

export const session = {
  user(): User | null {
    try {
      const id = localStorage.getItem(SESSION_KEY);
      return current().users.find((u) => u.id === id && u.active) ?? null;
    } catch {
      return null;
    }
  },
  login(id: string): void {
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {}
  },
  logout(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  },
};
