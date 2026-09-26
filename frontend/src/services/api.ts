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

  // Intelligence Layer
  async getForecast(productId: number) {
    return this.request<any>(`/intelligence/forecast/${productId}`);
  }

  async getStockoutRisk(riskTier?: string, categoryId?: number) {
    const params = new URLSearchParams();
    if (riskTier) params.append("risk_tier", riskTier);
    if (categoryId) params.append("category_id", categoryId.toString());
    const q = params.toString() ? `?${params.toString()}` : "";
    return this.request<any[]>(`/intelligence/stockout-risk${q}`);
  }

  async getReorderRecommendations(categoryId?: number, onlyActionable = false) {
    const params = new URLSearchParams();
    if (categoryId) params.append("category_id", categoryId.toString());
    if (onlyActionable) params.append("only_actionable", "true");
    const q = params.toString() ? `?${params.toString()}` : "";
    return this.request<any[]>(`/intelligence/reorder-recommendations${q}`);
  }

  async getExplainability(productId: number) {
    return this.request<any>(`/intelligence/explain/${productId}`);
  }

  async getPredictionAccuracy() {
    return this.request<any>("/intelligence/prediction-accuracy");
  }

  async evaluatePredictions() {
    return this.request<any>("/intelligence/evaluate-predictions", { method: "POST" });
  }

  // Anomalies & Known Events
  async getAnomalies(productId?: number, unacknowledgedOnly = false) {
    const params = new URLSearchParams();
    if (productId) params.append("product_id", productId.toString());
    if (unacknowledgedOnly) params.append("unacknowledged_only", "true");
    const q = params.toString() ? `?${params.toString()}` : "";
    return this.request<any[]>(`/anomalies${q}`);
  }

  async runAnomalyDetection() {
    return this.request<any>("/anomalies/detect", { method: "POST" });
  }

  async acknowledgeAnomaly(anomalyId: number) {
    return this.request<any>(`/anomalies/${anomalyId}/acknowledge`, { method: "POST" });
  }

  async getKnownEvents() {
    return this.request<any[]>("/anomalies/known-events");
  }

  async createKnownEvent(data: { name: string; start_date: string; end_date: string; description?: string; category_id?: number }) {
    return this.request<any>("/anomalies/known-events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Stock Health Score
  async getStockHealthScore() {
    return this.request<any>("/intelligence/stock-health-score");
  }

  // Notifications
  async getNotifications(unreadOnly = false) {
    const q = unreadOnly ? "?unread_only=true" : "";
    return this.request<any[]>(`/notifications${q}`);
  }

  async markNotificationRead(notificationId: number) {
    return this.request<any>(`/notifications/${notificationId}/read`, { method: "POST" });
  }

  async getSimulatedEmailLogs() {
    return this.request<any[]>("/notifications/simulated-emails");
  }
}

export const api = new ApiService();
