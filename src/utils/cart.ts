export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface CartState {
  items: CartItem[];
  mode: "domicilio" | "recoger";
  zone: string;
}

const KEY = "cafeteria-carrito";
const EVENT = "cart:change";
const empty: CartState = { items: [], mode: "domicilio", zone: "" };

function read(): CartState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : { ...empty };
  } catch {
    return { ...empty };
  }
}

function write(state: CartState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sin almacenamiento: el carrito vive solo en esta página */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
}

let state = read();

export const cart = {
  get: () => state,

  count: () => state.items.reduce((sum, item) => sum + item.qty, 0),

  subtotal: () => state.items.reduce((sum, item) => sum + item.qty * item.price, 0),

  qty: (id: string) => state.items.find((item) => item.id === id)?.qty ?? 0,

  change(product: Omit<CartItem, "qty">, delta: number) {
    const current = state.items.find((item) => item.id === product.id);
    const qty = Math.max(0, (current?.qty ?? 0) + delta);
    const others = state.items.filter((item) => item.id !== product.id);
    const items = qty === 0 ? others : current ? state.items.map((item) => (item.id === product.id ? { ...item, qty } : item)) : [...others, { ...product, qty }];
    state = { ...state, items };
    write(state);
  },

  setDelivery(mode: CartState["mode"], zone: string) {
    state = { ...state, mode, zone };
    write(state);
  },

  clear() {
    state = { ...state, items: [] };
    write(state);
  },

  subscribe(listener: (state: CartState) => void) {
    const handler = () => listener(state);
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", (event) => {
      if (event.key === KEY) {
        state = read();
        listener(state);
      }
    });
    listener(state);
    return () => window.removeEventListener(EVENT, handler);
  },
};
