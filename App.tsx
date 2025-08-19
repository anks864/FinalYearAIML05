// src/App.tsx
import React, { useEffect, useMemo, useReducer, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Plus,
  Package,
  Warehouse,
  ShoppingCart,
  Bell,
  LineChart,
  Coins,
  Upload,
  Download,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Send,
  CheckCheck,
  User,
} from "lucide-react";
import { v4 as uuid } from "uuid";

/* ---------------------- Types & Interfaces ---------------------- */

type Role =
  | "warehouse_manager"
  | "inventory_clerk"
  | "sales_associate"
  | "purchasing_officer"
  | "finance_manager"
  | "owner"
  | "admin";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  uom: string;
  description?: string;
  reorderPoint?: number;
  createdAt: string;
}

interface WarehouseLoc {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  updatedAt: string;
}

interface AuditLog {
  id: string;
  type:
    | "stock_update"
    | "order"
    | "receipt"
    | "transfer"
    | "adjustment"
    | "ack_alert"
    | string; // allow extra strings to prevent strict type issues
  user: string;
  ts: string;
  details: string;
}

interface OrderLine {
  productId: string;
  quantity: number;
}
interface Order {
  id: string;
  destination: string;
  lines: OrderLine[];
  createdBy: string;
  createdAt: string;
}

interface GoodsReceipt {
  id: string;
  poNumber: string;
  productId: string;
  quantity: number;
  receivedDate: string;
  warehouseId: string;
}

interface Transfer {
  id: string;
  sourceId: string;
  destId: string;
  productId: string;
  quantity: number;
  reason?: string;
  createdAt: string;
}

interface StockAdjustment {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reason: string;
  createdAt: string;
  approvedBy?: string;
}

interface Alert {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  threshold: number;
  createdAt: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
}

interface FinancialRecord {
  id: string;
  type: "purchase" | "return" | "order_cogs" | "adjustment" | "transfer" | "receipt";
  productId: string;
  unitCost: number;
  quantity: number;
  totalValue: number;
  ts: string;
}

interface State {
  currentUser: string;
  role: Role;
  products: Product[];
  warehouses: WarehouseLoc[];
  inventory: InventoryItem[];
  orders: Order[];
  receipts: GoodsReceipt[];
  transfers: Transfer[];
  adjustments: StockAdjustment[];
  alerts: Alert[];
  audit: AuditLog[];
  fin: FinancialRecord[];
}

/* ---------------------- Utilities ---------------------- */

const nowISO = () => new Date().toISOString();
const fmt = (iso: string) => new Date(iso).toLocaleString();
const STORAGE_KEY = "inventra_mvp_v1";

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function exportCSV(filename: string, rows: any[]) {
  const replacer = (_: any, value: any) => (value === null ? "" : value);
  const header = rows.length ? Object.keys(rows[0]) : [];
  const csv =
    (header.length ? header.join(",") + "\n" : "") +
    rows
      .map((r) => header.map((h) => JSON.stringify(r[h], replacer)).join(","))
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------------- Default Data & Reducer ---------------------- */

const DEFAULT_WAREHOUSES: WarehouseLoc[] = [
  { id: "wh1", name: "Main Warehouse" },
  { id: "wh2", name: "City Store" },
];

const initialState: State = {
  currentUser: "ankita",
  role: "owner",
  products: [],
  warehouses: DEFAULT_WAREHOUSES,
  inventory: [],
  orders: [],
  receipts: [],
  transfers: [],
  adjustments: [],
  alerts: [],
  audit: [],
  fin: [],
};

type Action =
  | { type: "bootstrap"; data: Partial<State> }
  | { type: "switch_role"; role: Role }
  | { type: "set_user"; user: string }
  | { type: "add_product"; product: Product }
  | { type: "add_inventory"; item: InventoryItem }
  | { type: "update_stock"; productId: string; warehouseId: string; quantityDelta: number; user: string }
  | { type: "add_order"; order: Order }
  | { type: "add_receipt"; receipt: GoodsReceipt }
  | { type: "add_transfer"; transfer: Transfer }
  | { type: "add_adjustment"; adj: StockAdjustment }
  | { type: "ack_alert"; alertId: string; user: string }
  | { type: "log"; entry: AuditLog }
  | { type: "add_alert"; alert: Alert }
  | { type: "add_fin"; rec: FinancialRecord };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "bootstrap": {
      const merged = { ...state, ...action.data } as State;
      save(STORAGE_KEY, merged);
      return merged;
    }
    case "switch_role": {
      const next = { ...state, role: action.role };
      save(STORAGE_KEY, next);
      return next;
    }
    case "set_user": {
      const next = { ...state, currentUser: action.user };
      save(STORAGE_KEY, next);
      return next;
    }
    case "add_product": {
      const next = { ...state, products: [...state.products, action.product] };
      // initialize inventory rows for product
      action.product &&
        state.warehouses.forEach((w) =>
          (next.inventory = [
            ...next.inventory,
            { id: uuid(), productId: action.product.id, warehouseId: w.id, quantity: 0, updatedAt: nowISO() },
          ])
        );
      save(STORAGE_KEY, next);
      return next;
    }
    case "add_inventory": {
      const next = { ...state, inventory: [...state.inventory, action.item] };
      save(STORAGE_KEY, next);
      return next;
    }
    case "update_stock": {
      const inv = state.inventory.map((it) =>
        it.productId === action.productId && it.warehouseId === action.warehouseId
          ? { ...it, quantity: it.quantity + action.quantityDelta, updatedAt: nowISO() }
          : it
      );
      const entry: AuditLog = {
        id: uuid(),
        type: "stock_update",
        user: action.user,
        ts: nowISO(),
        details: `Δ ${action.quantityDelta} product ${action.productId} @ ${action.warehouseId}`,
      };
      const next = { ...state, inventory: inv, audit: [entry, ...state.audit] };
      save(STORAGE_KEY, next);
      return next;
    }
    case "add_order": {
      const next = { ...state, orders: [action.order, ...state.orders] };
      save(STORAGE_KEY, next);
      return next;
    }
    case "add_receipt": {
      const next = { ...state, receipts: [action.receipt, ...state.receipts] };
      save(STORAGE_KEY, next);
      return next;
    }
    case "add_transfer": {
      const next = { ...state, transfers: [action.transfer, ...state.transfers] };
      save(STORAGE_KEY, next);
      return next;
    }
    case "add_adjustment": {
      const next = { ...state, adjustments: [action.adj, ...state.adjustments] };
      save(STORAGE_KEY, next);
      return next;
    }
    case "ack_alert": {
      const alerts = state.alerts.map((a) => (a.id === action.alertId ? { ...a, acknowledged: true, acknowledgedBy: action.user } : a));
      const entry: AuditLog = { id: uuid(), type: "ack_alert", user: action.user, ts: nowISO(), details: `Ack ${action.alertId}` };
      const next = { ...state, alerts, audit: [entry, ...state.audit] };
      save(STORAGE_KEY, next);
      return next;
    }
    case "add_alert": {
      const next = { ...state, alerts: [action.alert, ...state.alerts] };
      save(STORAGE_KEY, next);
      return next;
    }
    case "add_fin": {
      const next = { ...state, fin: [action.rec, ...state.fin] };
      save(STORAGE_KEY, next);
      return next;
    }
    case "log": {
      const next = { ...state, audit: [action.entry, ...state.audit] };
      save(STORAGE_KEY, next);
      return next;
    }
    default:
      return state;
  }
}

/* ---------------------- Helper hooks & helpers ---------------------- */

function useBootstrap() {
  const [state, dispatch] = useReducer(reducer, initialState, (base) => {
    const persisted = load<State>(STORAGE_KEY, base);
    return persisted;
  });
  useEffect(() => {
    save(STORAGE_KEY, state);
  }, [state]);
  return { state, dispatch } as const;
}

function getOnHand(inventory: InventoryItem[], productId: string, warehouseId: string) {
  const it = inventory.find((i) => i.productId === productId && i.warehouseId === warehouseId);
  return it ? it.quantity : 0;
}

function avgInventory(inventory: InventoryItem[], productId?: string) {
  const filtered = productId ? inventory.filter((i) => i.productId === productId) : inventory;
  if (!filtered.length) return 0;
  const total = filtered.reduce((sum, i) => sum + i.quantity, 0);
  return total / filtered.length;
}

/* ---------------------- UI subcomponents (in-file for clarity) ---------------------- */

function TopBar({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const [user, setUser] = useState(state.currentUser);
  return (
    <header className="w-full bg-white shadow-md px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Package className="h-6 w-6 text-brand-600" />
        <div className="text-2xl font-bold text-brand-600">INVENTRA</div>
        <div className="text-sm text-gray-500">MVP</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Input value={user} onChange={(e) => setUser(e.target.value)} className="w-40" />
          <Button
            className="btn btn-primary"
            onClick={() => {
              dispatch({ type: "set_user", user });
              toast.success(`User set to ${user}`);
            }}
          >
            Set User
          </Button>
        </div>

        <Select
          defaultValue={state.role}
          onValueChange={(val: Role) => {
            dispatch({ type: "switch_role", role: val });
            toast(`Role: ${val}`);
          }}
        >
          <SelectTrigger className="w-56 border rounded-lg p-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white shadow-lg rounded-lg">
            {(["owner", "warehouse_manager", "inventory_clerk", "sales_associate", "purchasing_officer", "finance_manager", "admin"] as Role[]).map(
              (r) => (
                <SelectItem key={r} value={r}>
                  {r.replace("_", " ")}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        <Button variant="ghost" className="relative">
          <Bell className="h-6 w-6 text-gray-600" />
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500" />
        </Button>
      </div>
    </header>
  );
}

/* ---------------------- Main App ---------------------- */

export default function App() {
  const { state, dispatch } = useBootstrap();

  /* ---------- Products form state ---------- */
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [uom, setUom] = useState("pcs");
  const [desc, setDesc] = useState("");
  const [reorder, setReorder] = useState<number>(5);

  /* ---------- Stock update state ---------- */
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(state.products[0]?.id);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>(state.warehouses[0]?.id);
  const [qty, setQty] = useState<number>(0);

  /* ---------- Orders state ---------- */
  const [orderDest, setOrderDest] = useState("");
  const [orderWarehouse, setOrderWarehouse] = useState<string | undefined>(state.warehouses[0]?.id);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [lineProduct, setLineProduct] = useState<string | undefined>(state.products[0]?.id);
  const [lineQty, setLineQty] = useState<number>(1);

  /* ---------- Receipts / Transfers / Adjustments ---------- */
  const [po, setPo] = useState("");
  const [rProduct, setRProduct] = useState<string | undefined>(state.products[0]?.id);
  const [rQty, setRQty] = useState<number>(0);
  const [rWh, setRWh] = useState<string | undefined>(state.warehouses[0]?.id);

  const [tProduct, setTProduct] = useState<string | undefined>(state.products[0]?.id);
  const [tQty, setTQty] = useState<number>(0);
  const [tSrc, setTSrc] = useState<string | undefined>(state.warehouses[0]?.id);
  const [tDst, setTDst] = useState<string | undefined>(state.warehouses[1]?.id);
  const [tReason, setTReason] = useState("");

  const [aProduct, setAProduct] = useState<string | undefined>(state.products[0]?.id);
  const [aQty, setAQTY] = useState<number>(0);
  const [aWh, setAWh] = useState<string | undefined>(state.warehouses[0]?.id);
  const [aReason, setAReason] = useState("Damage");

  /* ---------- Reports ---------- */
  const [from, setFrom] = useState<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    // keep selected product/warehouse synchronized when products/warehouses change
    if (!selectedProduct && state.products.length) setSelectedProduct(state.products[0].id);
    if (!selectedWarehouse && state.warehouses.length) setSelectedWarehouse(state.warehouses[0].id);
  }, [state.products, state.warehouses]);

  /* ---------- Product add ---------- */
  const addProduct = () => {
    if (!name || !sku || !category || !uom) return toast.error("Please fill required fields.");
    if (state.products.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) return toast.error("SKU must be unique.");
    const product: Product = { id: uuid(), name, sku, category, uom, description: desc, reorderPoint: reorder, createdAt: nowISO() };
    dispatch({ type: "add_product", product });
    toast.success("Product added & inventory initialized.");
    // reset
    setName("");
    setSku("");
    setCategory("");
    setUom("pcs");
    setDesc("");
    setReorder(5);
  };

  /* ---------- Stock update ---------- */
  const applyStock = (sign: 1 | -1) => {
    if (!selectedProduct || !selectedWarehouse) return toast.error("Select product & warehouse.");
    const delta = sign * Math.abs(qty);
    const onHand = getOnHand(state.inventory, selectedProduct, selectedWarehouse);
    if (onHand + delta < 0) return toast.error("Negative stock not allowed.");
    dispatch({ type: "update_stock", productId: selectedProduct, warehouseId: selectedWarehouse, quantityDelta: delta, user: state.currentUser });
    // check reorder
    const prod = state.products.find((p) => p.id === selectedProduct);
    const after = onHand + delta;
    if ((prod?.reorderPoint ?? Infinity) > after) {
      const alert: Alert = { id: uuid(), productId: selectedProduct, warehouseId: selectedWarehouse, quantity: after, threshold: prod?.reorderPoint ?? 0, createdAt: nowISO() };
      dispatch({ type: "add_alert", alert });
      toast("Low stock alert created.");
    }
    setQty(0);
  };

  /* ---------- Orders ---------- */
  const addLine = (productId?: string, quantity?: number) => {
    if (!productId || !quantity) return;
    setOrderLines((prev) => [...prev, { productId, quantity }]);
  };

  const submitOrder = () => {
    if (!orderDest || !orderWarehouse || orderLines.length === 0) return toast.error("Destination and items required.");
    for (const ln of orderLines) {
      const onHand = getOnHand(state.inventory, ln.productId, orderWarehouse);
      if (onHand < ln.quantity) return toast.error("Insufficient stock for some items.");
    }
    const order: Order = { id: uuid(), destination: orderDest, lines: orderLines, createdBy: state.currentUser, createdAt: nowISO() };
    // deduct stocks & record COGS (unitCost=1 for demo)
    orderLines.forEach((ln) => {
      dispatch({ type: "update_stock", productId: ln.productId, warehouseId: orderWarehouse!, quantityDelta: -ln.quantity, user: state.currentUser });
      dispatch({ type: "add_fin", rec: { id: uuid(), type: "order_cogs", productId: ln.productId, unitCost: 1, quantity: -ln.quantity, totalValue: -ln.quantity * 1, ts: nowISO() } });
    });
    dispatch({ type: "add_order", order });
    toast.success("Order placed & stock deducted.");
    setOrderDest("");
    setOrderLines([]);
  };

  /* ---------- Receipts ---------- */
  const createReceipt = () => {
    if (!po || !rProduct || !rWh) return toast.error("PO#, product, warehouse required.");
    const rec: GoodsReceipt = { id: uuid(), poNumber: po, productId: rProduct, quantity: rQty, receivedDate: nowISO(), warehouseId: rWh };
    dispatch({ type: "add_receipt", receipt: rec });
    dispatch({ type: "update_stock", productId: rProduct, warehouseId: rWh, quantityDelta: rQty, user: state.currentUser });
    dispatch({ type: "add_fin", rec: { id: uuid(), type: "receipt", productId: rProduct, unitCost: 1, quantity: rQty, totalValue: rQty * 1, ts: nowISO() } });
    toast.success("Receipt recorded.");
    setPo("");
    setRQty(0);
  };

  /* ---------- Transfers ---------- */
  const createTransfer = () => {
    if (!tProduct || !tSrc || !tDst) return toast.error("Pick product, source, destination.");
    if (tSrc === tDst) return toast.error("Source and destination must differ.");
    const onHand = getOnHand(state.inventory, tProduct, tSrc);
    if (onHand < tQty) return toast.error("Insufficient stock at source.");
    const tr: Transfer = { id: uuid(), sourceId: tSrc, destId: tDst, productId: tProduct, quantity: tQty, reason: tReason, createdAt: nowISO() };
    dispatch({ type: "add_transfer", transfer: tr });
    dispatch({ type: "update_stock", productId: tProduct, warehouseId: tSrc, quantityDelta: -tQty, user: state.currentUser });
    dispatch({ type: "update_stock", productId: tProduct, warehouseId: tDst, quantityDelta: +tQty, user: state.currentUser });
    dispatch({ type: "add_fin", rec: { id: uuid(), type: "transfer", productId: tProduct, unitCost: 0, quantity: 0, totalValue: 0, ts: nowISO() } });
    toast.success("Transfer completed.");
    setTQty(0);
    setTReason("");
  };

  /* ---------- Adjustments ---------- */
  const applyAdjustment = () => {
    if (!aProduct || !aWh || !aReason) return toast.error("Product, warehouse, and reason required.");
    if (aQty > 0 && state.role !== "admin") return toast.error("Positive adjustments require admin.");
    const onHand = getOnHand(state.inventory, aProduct, aWh);
    if (onHand + aQty < 0) return toast.error("Negative stock not allowed.");
    const adj: StockAdjustment = { id: uuid(), productId: aProduct, warehouseId: aWh, quantity: aQty, reason: aReason, createdAt: nowISO(), approvedBy: aQty > 0 ? state.currentUser : undefined };
    dispatch({ type: "add_adjustment", adj });
    dispatch({ type: "update_stock", productId: aProduct, warehouseId: aWh, quantityDelta: aQty, user: state.currentUser });
    dispatch({ type: "add_fin", rec: { id: uuid(), type: "adjustment", productId: aProduct, unitCost: 1, quantity: aQty, totalValue: aQty * 1, ts: nowISO() } });
    toast.success("Adjustment applied.");
    setAQTY(0);
  };

  /* ---------- Alerts handling ---------- */
  const acknowledge = (id: string) => dispatch({ type: "ack_alert", alertId: id, user: state.currentUser });

  /* ---------- Reports ---------- */
  const turnoverRows = useMemo(() => {
    const fromTs = new Date(from).getTime();
    const toTs = new Date(to).getTime() + 24 * 60 * 60 * 1000;
    return state.products.map((p) => {
      const cogs = state.fin
        .filter((f) => f.productId === p.id && f.type === "order_cogs" && new Date(f.ts).getTime() >= fromTs && new Date(f.ts).getTime() <= toTs)
        .reduce((s, f) => s + Math.abs(f.totalValue), 0);
      const avgInv = avgInventory(state.inventory.filter((i) => i.productId === p.id));
      const turnover = avgInv ? cogs / avgInv : 0;
      return { sku: p.sku, product: p.name, cogs, avgInv: Number(avgInv.toFixed(2)), turnover: Number(turnover.toFixed(2)) };
    });
  }, [state.fin, state.inventory, state.products, from, to]);

  /* ---------- UI helpers ---------- */
  const productOptions = state.products.map((p) => ({ id: p.id, label: `${p.name} (${p.sku})` }));
  const warehouseOptions = state.warehouses;

  /* ---------- Layout & Render ---------- */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopBar state={state} dispatch={dispatch} />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-72 bg-white shadow-md p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Quick Actions</h2>
            <p className="text-sm text-gray-500">Add a product, update stock, or create an order fast.</p>
          </div>

          <div className="space-y-2">
            <Button className="btn btn-primary w-full" onClick={() => window.scrollTo({ top: 600, behavior: "smooth" })}>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
            <Button className="btn btn-accent w-full" onClick={() => window.scrollTo({ top: 1200, behavior: "smooth" })}>
              <Warehouse className="mr-2 h-4 w-4" /> Update Stock
            </Button>
            <Button className="btn btn-warning w-full" onClick={() => window.scrollTo({ top: 1800, behavior: "smooth" })}>
              <ShoppingCart className="mr-2 h-4 w-4" /> Create Order
            </Button>
          </div>

          <div className="mt-auto">
            <div className="text-xs text-gray-500">Audit</div>
            <div className="mt-2 space-y-2 max-h-48 overflow-auto">
              {state.audit.slice(0, 8).map((a) => (
                <div key={a.id} className="text-xs border rounded-md p-2 bg-white">
                  <div className="font-medium">{a.type}</div>
                  <div className="text-muted">{a.details}</div>
                  <div className="text-right text-xs text-gray-400">{fmt(a.ts)}</div>
                </div>
              ))}
              {!state.audit.length && <div className="text-xs text-gray-400">No activity yet</div>}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-8 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="card">
              <CardContent>
                <h3 className="text-xl font-semibold text-brand-600">Products</h3>
                <p className="text-sm text-gray-600">Add and manage catalog items.</p>
                {/* Product Form */}
                <div className="mt-4 grid gap-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                  <Label>SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} />
                  <Label>Category</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                  <Label>Unit</Label>
                  <Input value={uom} onChange={(e) => setUom(e.target.value)} />
                  <Label>Reorder Point</Label>
                  <Input type="number" value={reorder} onChange={(e) => setReorder(parseInt(e.target.value || "0"))} />
                  <Label>Description</Label>
                  <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
                  <div className="flex gap-2">
                    <Button className="btn btn-primary" onClick={addProduct}>
                      <Plus className="h-4 w-4 mr-2" /> Save Product
                    </Button>
                    <Button variant="outline" onClick={() => exportCSV("products.csv", state.products)}>
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card">
              <CardContent>
                <h3 className="text-xl font-semibold text-accent">Stock</h3>
                <p className="text-sm text-gray-600">Update inventory quantities.</p>

                <div className="mt-4 space-y-2">
                  <Label>Product</Label>
                  <Select value={selectedProduct} onValueChange={(v) => setSelectedProduct(v)}>
                    <SelectTrigger className="w-full border rounded-lg p-2">
                      <SelectValue placeholder="Pick product" />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-lg rounded-lg max-h-60 overflow-auto">
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label>Warehouse</Label>
                  <Select value={selectedWarehouse} onValueChange={(v) => setSelectedWarehouse(v)}>
                    <SelectTrigger className="w-full border rounded-lg p-2">
                      <SelectValue placeholder="Pick warehouse" />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-lg rounded-lg">
                      {warehouseOptions.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label>Quantity</Label>
                  <Input type="number" value={qty} onChange={(e) => setQty(parseInt(e.target.value || "0"))} />
                  <div className="flex gap-2">
                    <Button className="btn btn-accent" onClick={() => applyStock(1)}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Add
                    </Button>
                    <Button className="btn btn-warning" onClick={() => applyStock(-1)}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Remove
                    </Button>
                    <Button variant="outline" onClick={() => exportCSV("stock.csv", state.inventory.map((i) => ({ productId: i.productId, warehouseId: i.warehouseId, qty: i.quantity })))}>
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card">
              <CardContent>
                <h3 className="text-xl font-semibold text-warning">Alerts</h3>
                <p className="text-sm text-gray-600">Low-stock notifications</p>
                <div className="mt-3 space-y-2">
                  {state.alerts.map((a) => {
                    const p = state.products.find((pp) => pp.id === a.productId);
                    const w = state.warehouses.find((ww) => ww.id === a.warehouseId);
                    return (
                      <div key={a.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{p?.name}</div>
                          <div className="text-xs text-gray-500">{w?.name} • Qty {a.quantity} / Threshold {a.threshold}</div>
                        </div>
                        <div>
                          {a.acknowledged ? (
                            <Badge className="bg-gray-200">Acknowledged</Badge>
                          ) : (
                            <Button className="btn btn-primary" onClick={() => acknowledge(a.id)}>
                              <CheckCheck className="h-4 w-4 mr-2" /> Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!state.alerts.length && <div className="text-sm text-gray-400">No alerts</div>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders / Receipts / Transfers / Adjustments area */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="card">
              <CardContent>
                <h4 className="text-lg font-semibold text-gray-800">Create Order</h4>
                <div className="mt-3 space-y-2">
                  <Label>Destination</Label>
                  <Input value={orderDest} onChange={(e) => setOrderDest(e.target.value)} placeholder="Customer or store" />
                  <Label>Warehouse (source)</Label>
                  <Select value={orderWarehouse} onValueChange={(v) => setOrderWarehouse(v)}>
                    <SelectTrigger className="w-full border rounded-lg p-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-lg rounded-lg">
                      {warehouseOptions.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-7 gap-2 items-end">
                    <div className="col-span-4">
                      <Label>Product</Label>
                      <Select value={lineProduct} onValueChange={(v) => setLineProduct(v)}>
                        <SelectTrigger className="w-full border rounded-lg p-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white shadow-lg rounded-lg max-h-60 overflow-auto">
                          {productOptions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Qty</Label>
                      <Input type="number" value={lineQty} onChange={(e) => setLineQty(parseInt(e.target.value || "0"))} />
                    </div>
                    <Button className="col-span-1 btn btn-primary" onClick={() => addLine(lineProduct, lineQty)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    {orderLines.map((ln, i) => {
                      const p = state.products.find((pp) => pp.id === ln.productId);
                      return (
                        <div key={i} className="text-sm">
                          {p?.name} × {ln.quantity}
                        </div>
                      );
                    })}
                    {!orderLines.length && <div className="text-xs text-gray-400">Add items above…</div>}
                  </div>

                  <div className="flex gap-2">
                    <Button className="btn btn-accent" onClick={submitOrder}>
                      <Send className="mr-2 h-4 w-4" /> Submit Order
                    </Button>
                    <Button variant="outline" onClick={() => exportCSV("orders.csv", state.orders)}>
                      Export History
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card">
              <CardContent>
                <h4 className="text-lg font-semibold text-gray-800">Receive Goods</h4>
                <div className="mt-3 space-y-2">
                  <Label>PO #</Label>
                  <Input value={po} onChange={(e) => setPo(e.target.value)} />
                  <Label>Product</Label>
                  <Select value={rProduct} onValueChange={(v) => setRProduct(v)}>
                    <SelectTrigger className="w-full border rounded-lg p-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-lg rounded-lg">
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label>Warehouse</Label>
                  <Select value={rWh} onValueChange={(v) => setRWh(v)}>
                    <SelectTrigger className="w-full border rounded-lg p-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-lg rounded-lg">
                      {warehouseOptions.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label>Quantity</Label>
                  <Input type="number" value={rQty} onChange={(e) => setRQty(parseInt(e.target.value || "0"))} />

                  <div className="flex gap-2">
                    <Button className="btn btn-primary" onClick={createReceipt}>
                      <Upload className="mr-2 h-4 w-4" /> Receive
                    </Button>
                    <Button variant="outline" onClick={() => exportCSV("receipts.csv", state.receipts)}>
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card">
              <CardContent>
                <h4 className="text-lg font-semibold text-gray-800">Transfers & Adjustments</h4>
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="text-sm font-medium">Transfer</div>
                    <Label>Product</Label>
                    <Select value={tProduct} onValueChange={(v) => setTProduct(v)}>
                      <SelectTrigger className="w-full border rounded-lg p-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white shadow-lg rounded-lg">
                        {productOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Source</Label>
                        <Select value={tSrc} onValueChange={(v) => setTSrc(v)}>
                          <SelectTrigger className="w-full border rounded-lg p-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white shadow-lg rounded-lg">
                            {warehouseOptions.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Destination</Label>
                        <Select value={tDst} onValueChange={(v) => setTDst(v)}>
                          <SelectTrigger className="w-full border rounded-lg p-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white shadow-lg rounded-lg">
                            {warehouseOptions.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Label>Qty</Label>
                    <Input type="number" value={tQty} onChange={(e) => setTQty(parseInt(e.target.value || "0"))} />
                    <Label>Reason</Label>
                    <Input value={tReason} onChange={(e) => setTReason(e.target.value)} />
                    <Button className="btn btn-accent mt-2" onClick={createTransfer}>
                      <Send className="mr-2 h-4 w-4" /> Transfer
                    </Button>
                  </div>

                  <hr />

                  <div>
                    <div className="text-sm font-medium">Adjustments</div>
                    <Label>Product</Label>
                    <Select value={aProduct} onValueChange={(v) => setAProduct(v)}>
                      <SelectTrigger className="w-full border rounded-lg p-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white shadow-lg rounded-lg">
                        {productOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Label>Warehouse</Label>
                    <Select value={aWh} onValueChange={(v) => setAWh(v)}>
                      <SelectTrigger className="w-full border rounded-lg p-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white shadow-lg rounded-lg">
                        {warehouseOptions.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Label>Quantity (negative for damage)</Label>
                    <Input type="number" value={aQty} onChange={(e) => setAQTY(parseInt(e.target.value || "0"))} />
                    <Label>Reason</Label>
                    <Input value={aReason} onChange={(e) => setAReason(e.target.value)} />
                    <Button className="btn btn-warning mt-2" onClick={applyAdjustment}>
                      <ShieldCheck className="mr-2 h-4 w-4" /> Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reports: Turnover & Financial */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="card lg:col-span-2">
              <CardContent>
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-800">Inventory Turnover</h4>
                  <div className="flex gap-2 items-end">
                    <div>
                      <Label>From</Label>
                      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div>
                      <Label>To</Label>
                      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <Button variant="outline" onClick={() => exportCSV("turnover.csv", turnoverRows)}>
                      <Download className="mr-2 h-4 w-4" /> CSV
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {turnoverRows.map((r, i) => (
                    <div key={i} className="border rounded-lg p-3">
                      <div className="font-semibold">{r.product}</div>
                      <div className="text-xs text-gray-500">{r.sku}</div>
                      <div className="text-sm">COGS: {r.cogs}</div>
                      <div className="text-sm">Avg Inv: {r.avgInv}</div>
                      <div className="text-sm font-medium">Turnover: {r.turnover}</div>
                    </div>
                  ))}
                  {!turnoverRows.length && <div className="text-sm text-gray-400">No data</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="card">
              <CardContent>
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-800">Financial Records</h4>
                  <Button variant="outline" onClick={() => exportCSV("financials.csv", state.fin)}>
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                </div>
                <div className="mt-3 space-y-2 max-h-64 overflow-auto">
                  {state.fin.map((f) => {
                    const p = state.products.find((pp) => pp.id === f.productId);
                    return (
                      <div key={f.id} className="border rounded-md p-2">
                        <div className="font-medium">{p?.name}</div>
                        <div className="text-xs text-gray-500">{f.type} • {fmt(f.ts)}</div>
                        <div className="text-sm">Qty: {f.quantity} • Unit: {f.unitCost}</div>
                        <div className="text-sm font-semibold">Total: {f.totalValue}</div>
                      </div>
                    );
                  })}
                  {!state.fin.length && <div className="text-sm text-gray-400">No financial entries</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
