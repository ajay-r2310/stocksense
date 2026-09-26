const API_BASE_URL = "http://localhost:8000/api/v1";

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem("stocksense_token");
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Clear token if expired/unauthorized
      localStorage.removeItem("stocksense_token");
      localStorage.removeItem("stocksense_user");
      window.dispatchEvent(new Event("auth-changed"));
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error occurred" }));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ access_token: string; token_type: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request<any>("/auth/me");
  }

  // Products
  async getProducts() {
    return this.request<any[]>("/products");
  }

  async getCategories() {
    return this.request<any[]>("/products/categories");
  }

  async getUOMs() {
    return this.request<any[]>("/products/uoms");
  }

  // Warehouses & Locations
  async getWarehouses() {
    return this.request<any[]>("/warehouses");
  }

  async getLocations(warehouseId: number) {
    return this.request<any[]>(`/warehouses/${warehouseId}/locations`);
  }

  // Suppliers
  async getSuppliers() {
    return this.request<any[]>("/suppliers");
  }

  // Inventory & Ledger
  async getStockByLocation(warehouseId?: number) {
    const query = warehouseId ? `?warehouse_id=${warehouseId}` : "";
    return this.request<any[]>(`/inventory/stock-by-location${query}`);
  }

  async getMovements(skip = 0, limit = 50, productId?: number) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (productId) params.append("product_id", productId.toString());
    return this.request<any[]>(`/inventory/movements?${params.toString()}`);
  }

  async createMovement(data: any) {
    return this.request<any>("/inventory/movements", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async checkInvariant() {
    return this.request<any>("/inventory/invariant-check");
  }

  // Adjustments & Approvals
  async getAdjustments() {
    return this.request<any[]>("/inventory/adjustments");
  }

  async submitAdjustment(data: { product_id: number; location_id: number; counted_qty: number; reason: string }) {
    return this.request<any>("/inventory/adjustments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async approveAdjustment(adjustmentId: number) {
    return this.request<any>(`/inventory/adjustments/${adjustmentId}/approve`, {
      method: "POST",
    });
  }

  async rejectAdjustment(adjustmentId: number) {
    return this.request<any>(`/inventory/adjustments/${adjustmentId}/reject`, {
      method: "POST",
    });
  }

  // Orders
  async getPurchaseOrders() {
    return this.request<any[]>("/orders/purchase-orders");
  }

  async getSalesOrders() {
    return this.request<any[]>("/orders/sales-orders");
  }

  async receivePO(poId: number, destinationLocationId: number, items: Array<{ product_id: number; qty: number }>) {
    return this.request<any>(`/orders/purchase-orders/${poId}/receive?destination_location_id=${destinationLocationId}`, {
      method: "POST",
      body: JSON.stringify(items),
    });
  }

  async deliverSO(soId: number, sourceLocationId: number, items: Array<{ product_id: number; qty: number }>) {
    return this.request<any>(`/orders/sales-orders/${soId}/deliver?source_location_id=${sourceLocationId}`, {
      method: "POST",
      body: JSON.stringify(items),
    });
  }
}

export const api = new ApiService();
