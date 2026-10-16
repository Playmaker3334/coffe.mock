export type Category = "calientes" | "frios" | "desayunos" | "comida" | "panaderia" | "grano";
export type ComboGroup = "bebida" | "pan" | "plato";
export type SizeId = "chico" | "grande";

export interface Size {
  id: SizeId;
  price: number;
  active: boolean;
}

export interface RecipeLine {
  insumoId: string;
  qty: number;
  unit: Unit;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  sizes: Size[];
  stockInit: number | null;
  stock: number | null;
  promo: boolean;
  active: boolean;
  recipe: RecipeLine[];
}

export type Unit = "g" | "kg" | "ml" | "l" | "pza";

export interface Insumo {
  id: string;
  name: string;
  unit: Unit;
  packQty: number;
  packUnit: Unit;
  packPrice: number;
  current: number;
  min: number;
  max: number;
  supplier: string;
}

export interface Promotion {
  id: string;
  name: string;
  price: number;
  slots: ComboGroup[];
  employeeBenefit: boolean;
  employeePrice: number;
  active: boolean;
}

export type CustomerType = "general" | "frecuente" | "empleado" | "empresa";
export type BenefitType = "ninguno" | "descuento" | "cortesia";

export interface Customer {
  phone: string;
  name: string;
  type: CustomerType;
  discountPct: number;
  company: string;
  benefit: BenefitType;
  benefitDailyLimit: number | null;
  notes: string;
}

export type MovementType = "abono" | "consumo" | "devolucion";

export interface BalanceMovement {
  id: string;
  phone: string;
  type: MovementType;
  amount: number;
  method: string;
  saleId: number | null;
  at: string;
  by: string;
}

export type CouponStatus = "active" | "used" | "cancelled";

export interface Coupon {
  id: string;
  phone: string;
  kind: "percent" | "fixed";
  value: number;
  concept: string;
  status: CouponStatus;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  usedAt: string | null;
  usedSaleId: number | null;
  discountApplied: number;
}

export interface OrderLine {
  productId: string;
  size: SizeId;
  qty: number;
  price: number;
  name: string;
}

export interface Payment {
  method: string;
  cash: number;
  other: number;
  otherMethod: string;
  received: number;
}

export interface AppliedCombo {
  promoId: string;
  name: string;
  price: number;
  items: { productId: string; name: string; price: number }[];
}

export type OrderStatus = 0 | 1 | 2 | 3 | 4 | 5;
export type OrderType = "mostrador" | "recoger" | "domicilio";
export type Channel = "caja" | "telefono" | "web";

export interface Order {
  id: number;
  createdAt: string;
  channel: Channel;
  type: OrderType;
  phone: string;
  guestName: string;
  address: string;
  slot: string;
  lines: OrderLine[];
  combos: AppliedCombo[];
  subtotal: number;
  base: number;
  discountPct: number;
  discountAmount: number;
  employeeDiscount: number;
  benefitCombos: number;
  couponId: string | null;
  couponDiscount: number;
  total: number;
  credit: number;
  deposit: { amount: number; method: string; at: string } | null;
  balanceUsed: number;
  payment: Payment | null;
  paidAt: string | null;
  status: OrderStatus;
  statusAt: string;
  notes: { at: string; by: string; text: string }[];
  createdBy: string;
}

export type ModuleId =
  | "caja" | "barra" | "productos" | "inventario" | "promociones"
  | "clientes" | "credito" | "cupones" | "corte" | "cierre" | "ventas" | "ajustes";

export type Access = "read" | "write";

export interface User {
  id: string;
  name: string;
  role: string;
  isAdmin: boolean;
  active: boolean;
  permissions: Partial<Record<ModuleId, Access>>;
}

export interface CashCount {
  id: string;
  day: string;
  at: string;
  by: string;
  denominations: Record<string, number>;
  counted: number;
  nonCash: number;
  float: number;
  expectedCash: number;
  expectedNonCash: number;
}

export interface Settings {
  orderStart: string;
  orderEnd: string;
  deliveryEnabled: boolean;
  cashFloat: number;
  slots: { time: string; deliveryLimit: number; pickupLimit: number }[];
}

export interface AppState {
  version: number;
  nextOrderId: number;
  products: Product[];
  insumos: Insumo[];
  promotions: Promotion[];
  customers: Customer[];
  movements: BalanceMovement[];
  coupons: Coupon[];
  orders: Order[];
  users: User[];
  counts: CashCount[];
  settings: Settings;
}
