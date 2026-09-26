export type UserRole = "Admin" | "Inventory Manager" | "Warehouse Worker" | "Viewer";

export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  warehouse_scope?: number | null;
  role?: {
    id: number;
    name: UserRole;
    description?: string;
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
}

export interface UnitOfMeasure {
  id: number;
  name: string;
  symbol: string;
  category?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_info?: string;
  default_lead_time_days: number;
  reliability_score: number;
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  address?: string;
}

export interface Location {
  id: number;
  warehouse_id: number;
  name: string;
  code?: string;
  parent_location_id?: number | null;
  warehouse?: Warehouse;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category_id: number;
  base_uom_id: number;
  purchase_uom_id?: number | null;
  uom_conversion_factor: number;
  primary_supplier_id?: number | null;
  reorder_level: number;
  safety_stock: number;
  average_cost: number;
  is_lot_tracked: boolean;
  category?: Category;
  base_uom?: UnitOfMeasure;
  primary_supplier?: Supplier;
}

export interface StockByLocation {
  id: number;
  product_id: number;
  location_id: number;
  lot_id?: number | null;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
  product?: Product;
  location?: Location;
}

export interface StockMovement {
  id: number;
  product_id: number;
  lot_id?: number | null;
  source_location_id?: number | null;
  destination_location_id?: number | null;
  quantity: number;
  movement_type: "RECEIPT" | "DELIVERY" | "TRANSFER_IN" | "TRANSFER_OUT" | "RETURN_IN" | "RETURN_OUT" | "ADJUSTMENT";
  reference_id?: string;
  reason?: string;
  unit_cost?: number;
  user_id?: number;
  timestamp: string;
  product?: Product;
  source_location?: Location;
  destination_location?: Location;
}

export interface PurchaseOrderLine {
  id: number;
  purchase_order_id: number;
  product_id: number;
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
  product?: Product;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  warehouse_id: number;
  status: "draft" | "confirmed" | "partial" | "done" | "cancelled";
  expected_date?: string;
  created_at: string;
  supplier?: Supplier;
  warehouse?: Warehouse;
  lines: PurchaseOrderLine[];
}

export interface SalesOrderLine {
  id: number;
  sales_order_id: number;
  product_id: number;
  ordered_qty: number;
  delivered_qty: number;
  unit_price: number;
  product?: Product;
}

export interface SalesOrder {
  id: number;
  so_number: string;
  customer_id?: string;
  customer_name: string;
  warehouse_id: number;
  status: "draft" | "confirmed" | "partial" | "done" | "cancelled";
  expected_delivery_date?: string;
  created_at: string;
  warehouse?: Warehouse;
  lines: SalesOrderLine[];
}

export interface InventoryAdjustment {
  id: number;
  product_id: number;
  location_id: number;
  recorded_qty: number;
  counted_qty: number;
  difference: number;
  reason: string;
  requested_by: number;
  approved_by?: number | null;
  status: "pending_approval" | "approved" | "rejected";
  created_at: string;
  resolved_at?: string | null;
  product?: Product;
  location?: Location;
  requester?: User;
  approver?: User;
}

export interface InvariantResult {
  is_valid: boolean;
  total_locations_checked: number;
  discrepancies: Array<{
    product_id: number;
    location_id: number;
    recorded_on_hand: number;
    calculated_from_ledger: number;
    discrepancy: number;
  }>;
}
