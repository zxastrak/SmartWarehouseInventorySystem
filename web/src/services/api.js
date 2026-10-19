// API Service for SUSUNO Web Management Console
// Based on API Reference — Smart Warehouse Inventory System (Express + MySQL)

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('susuno_token') || null;
    this.user = JSON.parse(localStorage.getItem('susuno_user') || 'null');
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem('susuno_token', token);
      localStorage.setItem('susuno_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('susuno_token');
      localStorage.removeItem('susuno_user');
    }
  }

  clearAuth() {
    this.setAuth(null, null);
  }

  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = this.getHeaders(options.headers);

    const config = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const error = new Error(data?.message || `HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      // Annotate network errors
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        err.isNetworkError = true;
        err.message = 'Tidak dapat terhubung ke server backend Express (localhost:5000). Pastikan server backend sedang aktif.';
      }
      throw err;
    }
  }

  // ================= 2.1 Autentikasi (/auth) =================
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password },
    });
    if (data.token) {
      this.setAuth(data.token, data.user);
    }
    return data;
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });
  }

  async resetPassword(email, new_password) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: { email: email.trim(), new_password },
    });
  }

  // ================= 2.2 Akun (/users) (Manager Only) =================
  async getUsers(role) {
    const query = role ? `?role=${encodeURIComponent(role)}` : '';
    return this.request(`/users${query}`);
  }

  async getUserById(id) {
    return this.request(`/users/${id}`);
  }

  async updateUser(id, data) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deactivateUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async activateUser(id) {
    return this.request(`/users/${id}/activate`, {
      method: 'PATCH',
    });
  }

  // ================= 2.3 Kategori (/categories) =================
  async getCategories() {
    return this.request('/categories');
  }

  async getCategoryById(id) {
    return this.request(`/categories/${id}`);
  }

  async createCategory(data) {
    return this.request('/categories', {
      method: 'POST',
      body: data,
    });
  }

  async updateCategory(id, data) {
    return this.request(`/categories/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteCategory(id) {
    return this.request(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // ================= 2.4 Supplier (/suppliers) =================
  async getSuppliers() {
    return this.request('/suppliers');
  }

  async getSupplierById(id) {
    return this.request(`/suppliers/${id}`);
  }

  async createSupplier(data) {
    return this.request('/suppliers', {
      method: 'POST',
      body: data,
    });
  }

  async updateSupplier(id, data) {
    return this.request(`/suppliers/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteSupplier(id) {
    return this.request(`/suppliers/${id}`, {
      method: 'DELETE',
    });
  }

  // ================= 2.5 Lokasi Rak (/locations) =================
  async getLocations() {
    return this.request('/locations');
  }

  async getLocationById(id) {
    return this.request(`/locations/${id}`);
  }

  async createLocation(data) {
    return this.request('/locations', {
      method: 'POST',
      body: data,
    });
  }

  async updateLocation(id, data) {
    return this.request(`/locations/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteLocation(id) {
    return this.request(`/locations/${id}`, {
      method: 'DELETE',
    });
  }

  // ================= 2.6 Produk (/products) =================
  async getProducts() {
    return this.request('/products');
  }

  async getProductBySku(sku) {
    return this.request(`/products/sku/${encodeURIComponent(sku)}`);
  }

  async getProductById(id) {
    return this.request(`/products/${id}`);
  }

  async createProduct(data) {
    return this.request('/products', {
      method: 'POST',
      body: data,
    });
  }

  async updateProduct(id, data) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteProduct(id) {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // ================= 2.7 Transaksi Stok (/stock-transactions) =================
  async getStockTransactions() {
    return this.request('/stock-transactions');
  }

  async getMyStockTransactions() {
    return this.request('/stock-transactions/me');
  }

  async getProductStockTransactions(productId) {
    return this.request(`/stock-transactions/product/${productId}`);
  }

  async createStockTransaction(data) {
    return this.request('/stock-transactions', {
      method: 'POST',
      body: data,
    });
  }

  // ================= 2.8 Task (/tasks) =================
  async getTasks() {
    return this.request('/tasks');
  }

  async getTaskById(id) {
    return this.request(`/tasks/${id}`);
  }

  async getTaskHistory(id) {
    return this.request(`/tasks/${id}/history`);
  }

  async createTask(data) {
    return this.request('/tasks', {
      method: 'POST',
      body: data,
    });
  }

  async reassignTask(id, data = {}) {
    return this.request(`/tasks/${id}/reassign`, {
      method: 'PATCH',
      body: data,
    });
  }

  async updateTaskStatus(id, status) {
    return this.request(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }

  // ================= 2.9 Shift (/shifts) =================
  async getShifts() {
    return this.request('/shifts');
  }

  async getMyShifts(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/shifts/me${query}`);
  }

  async getShiftById(id) {
    return this.request(`/shifts/${id}`);
  }

  async createShift(data) {
    return this.request('/shifts', {
      method: 'POST',
      body: data,
    });
  }

  async updateShift(id, data) {
    return this.request(`/shifts/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteShift(id) {
    return this.request(`/shifts/${id}`, {
      method: 'DELETE',
    });
  }

  // ================= 2.10 Absensi (/attendances) =================
  async getAttendances() {
    return this.request('/attendances');
  }

  async getMyAttendances() {
    return this.request('/attendances/me');
  }

  async checkIn() {
    return this.request('/attendances/check-in', {
      method: 'POST',
    });
  }

  async checkOut() {
    return this.request('/attendances/check-out', {
      method: 'POST',
    });
  }

  // ================= 2.11 Purchase Order (/purchase-orders) =================
  async getPurchaseOrders() {
    return this.request('/purchase-orders');
  }

  async getPurchaseOrderById(id) {
    return this.request(`/purchase-orders/${id}`);
  }

  async createPurchaseOrder(data) {
    return this.request('/purchase-orders', {
      method: 'POST',
      body: data,
    });
  }

  async updatePurchaseOrderStatus(id, status) {
    return this.request(`/purchase-orders/${id}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }

  // ================= 2.12 Audit Log (/audit-logs) =================
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams();
    if (params.action) query.append('action', params.action);
    if (params.user_id) query.append('user_id', params.user_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/audit-logs${qs}`);
  }
}

export const api = new ApiService();
export default api;
