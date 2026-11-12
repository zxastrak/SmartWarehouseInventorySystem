const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const TOKEN_KEY = 'susuno_auth_token';
export const USER_KEY = 'susuno_auth_user';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to save session to localStorage:', err);
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error('Failed to clear session from localStorage:', err);
  }
}

// Token helper to check payload expiry (8h)
export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    // Tidak menghapus sesi sembarangan agar data manajer tidak hilang di layar
    if (response.status === 401 || response.status === 403) {
      console.warn('API returned unauthorized/forbidden:', url, data?.message);
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'Tidak dapat terhubung ke backend. Pastikan server backend (port 5000) sudah berjalan.',
    };
  }
}

export const authApi = {
  // Login: POST /api/auth/login, body: { email, password }
  login: async ({ email, password }) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.ok && res.status === 200) {
      const { token, user } = res.data;

      // Web khusus untuk role 'manager'
      if (user?.role !== 'manager') {
        return {
          success: false,
          status: 403,
          message: 'Akses dashboard Web khusus akun Manager. Akun staf silakan login via aplikasi Mobile SUSUNO.',
        };
      }

      setAuthSession(token, user);
      return {
        success: true,
        token,
        user,
      };
    }

    // Tangani error spesifik
    if (res.status === 401) {
      return {
        success: false,
        status: 401,
        message: res.data?.message || 'Email atau password salah',
      };
    }

    if (res.status === 403) {
      return {
        success: false,
        status: 403,
        message: res.data?.message || 'Akses ditolak',
      };
    }

    return {
      success: false,
      status: res.status,
      message: res.data?.message || res.error || 'Gagal terhubung ke server autentikasi',
    };
  },

  // Kirim Kode OTP via Email: POST /api/auth/send-otp, body: { email, type }
  sendOtp: async (email, type = 'reset') => {
    const res = await apiFetch('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, type }),
    });
    return {
      success: res.ok,
      status: res.status,
      message: res.data?.message || res.data?.error || res.error || 'Gagal mengirim kode OTP',
      devOtp: res.data?.devOtp,
    };
  },

  // Registrasi Manager Baru: POST /api/auth/register-manager
  registerManager: async ({ name, email, password, resetToken }) => {
    const res = await apiFetch('/auth/register-manager', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, resetToken }),
    });
    return {
      success: res.ok,
      status: res.status,
      message: res.data?.message || res.error || 'Gagal mendaftarkan manager',
      userId: res.data?.userId,
    };
  },

  // Verifikasi Kode OTP: POST /api/auth/verify-otp, body: { email, otp }
  verifyOtp: async (email, otp) => {
    const res = await apiFetch('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
    return {
      success: res.ok,
      status: res.status,
      message: res.data?.message || res.error || 'Gagal verifikasi kode OTP',
      resetToken: res.data?.resetToken,
    };
  },

  // Reset Password: POST /api/auth/reset-password
  // body: { email, new_password, resetToken? }
  resetPassword: async ({ email, new_password, resetToken }) => {
    if (!new_password || new_password.length < 8) {
      return {
        success: false,
        status: 400,
        message: 'Password baru minimal 8 karakter',
      };
    }

    const res = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, new_password, resetToken }),
    });

    if (res.ok && res.status === 200) {
      return {
        success: true,
        message: res.data?.message || 'Password berhasil direset',
      };
    }

    return {
      success: false,
      status: res.status,
      message: res.data?.message || res.error || 'Gagal mereset password',
    };
  },

  // Register: POST /api/auth/register (Manager only)
  registerStaff: async ({ name, email, password, role }) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });

    if (res.status === 201) {
      return { success: true, userId: res.data?.userId, message: res.data?.message };
    }

    return {
      success: false,
      status: res.status,
      message: res.data?.message || 'Gagal mendaftarkan akun',
    };
  },

  // Ambil audit logs: GET /api/audit-logs?action=PASSWORD_RESET
  getPasswordResetLogs: async () => {
    const res = await apiFetch('/audit-logs?action=PASSWORD_RESET', {
      method: 'GET',
    });
    if (res.ok && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  },
};

export const productsApi = {
  getAll: async () => {
    const res = await apiFetch('/products');
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  getBySku: async (sku) => {
    const res = await apiFetch(`/products/sku/${encodeURIComponent(sku)}`);
    return res.ok ? res.data : null;
  },
  create: async (productData) => {
    const res = await apiFetch('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  update: async (id, productData) => {
    const res = await apiFetch(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  remove: async (id) => {
    const res = await apiFetch(`/products/${id}`, { method: 'DELETE' });
    return { success: res.ok, status: res.status, data: res.data };
  },
};

export const uploadApi = {
  uploadImage: async (base64OrUrl, folder = 'products', filename = '') => {
    const res = await apiFetch('/upload', {
      method: 'POST',
      body: JSON.stringify({ image: base64OrUrl, folder, filename }),
    });
    return {
      success: res.ok,
      status: res.status,
      url: res.data?.url || base64OrUrl,
      relativeUrl: res.data?.relativeUrl,
      data: res.data,
      error: res.data?.message || res.error,
    };
  },
};

export const transactionsApi = {
  getAll: async () => {
    const res = await apiFetch('/stock-transactions');
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  create: async ({ product_id, type, quantity, notes }) => {
    const res = await apiFetch('/stock-transactions', {
      method: 'POST',
      body: JSON.stringify({ product_id, type, quantity, notes }),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  getByProduct: async (productId) => {
    const res = await apiFetch(`/stock-transactions/product/${productId}`);
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
};

export const purchaseOrdersApi = {
  getAll: async () => {
    const res = await apiFetch('/purchase-orders');
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  getById: async (id) => {
    const res = await apiFetch(`/purchase-orders/${id}`);
    return res.ok ? res.data : null;
  },
  create: async (data) => {
    const res = await apiFetch('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  update: async (id, data) => {
    const res = await apiFetch(`/purchase-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  updateStatus: async (id, status) => {
    const res = await apiFetch(`/purchase-orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  remove: async (id) => {
    const res = await apiFetch(`/purchase-orders/${id}`, {
      method: 'DELETE',
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
};

export const categoriesApi = {
  getAll: async () => {
    const res = await apiFetch('/categories');
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  create: async (data) => {
    const res = await apiFetch('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  update: async (id, data) => {
    const res = await apiFetch(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  remove: async (id) => {
    const res = await apiFetch(`/categories/${id}`, {
      method: 'DELETE',
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
};

export const suppliersApi = {
  getAll: async () => {
    const res = await apiFetch('/suppliers');
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  getById: async (id) => {
    const res = await apiFetch(`/suppliers/${id}`);
    return res.ok ? res.data : null;
  },
  create: async (data) => {
    const res = await apiFetch('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  update: async (id, data) => {
    const res = await apiFetch(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  remove: async (id) => {
    const res = await apiFetch(`/suppliers/${id}`, {
      method: 'DELETE',
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
};

export const locationsApi = {
  getAll: async () => {
    const res = await apiFetch('/locations');
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  create: async (data) => {
    const res = await apiFetch('/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  update: async (id, data) => {
    const res = await apiFetch(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  remove: async (id) => {
    const res = await apiFetch(`/locations/${id}`, {
      method: 'DELETE',
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
};

export const auditLogsApi = {
  getAll: async (action = '') => {
    const url = action ? `/audit-logs?action=${encodeURIComponent(action)}` : '/audit-logs';
    const res = await apiFetch(url);
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  create: async ({ action, table_affected, record_id }) => {
    const res = await apiFetch('/audit-logs', {
      method: 'POST',
      body: JSON.stringify({ action, table_affected, record_id }),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
};

export const inboundApi = {
  getAll: async () => {
    const res = await apiFetch('/inbound');
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  getById: async (id) => {
    const res = await apiFetch(`/inbound/${encodeURIComponent(id)}`);
    return res.ok ? res.data : null;
  },
  create: async (data) => {
    const res = await apiFetch('/inbound', { method: 'POST', body: JSON.stringify(data) });
    return { success: res.ok, status: res.status, data: res.data };
  },
  update: async (id, data) => {
    const res = await apiFetch(`/inbound/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
    return { success: res.ok, status: res.status, data: res.data };
  },
  updateStatus: async (id, status, notes) => {
    const res = await apiFetch(`/inbound/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  inspect: async (id, data = {}) => {
    const res = await apiFetch(`/inbound/${encodeURIComponent(id)}/inspect`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  // Selesaikan receiving — update stok ke MySQL via backend
  completeReceiving: async (id, items, notes) => {
    const res = await apiFetch(`/inbound/${encodeURIComponent(id)}/receive`, {
      method: 'POST',
      body: JSON.stringify({ items, notes }),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  remove: async (id) => {
    const res = await apiFetch(`/inbound/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { success: res.ok, status: res.status, data: res.data };
  },
};

export const outboundApi = {
  getAll: async () => {
    const res = await apiFetch('/outbound');
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  getById: async (id) => {
    const res = await apiFetch(`/outbound/${encodeURIComponent(id)}`);
    return res.ok ? res.data : null;
  },
  create: async (data) => {
    const res = await apiFetch('/outbound', { method: 'POST', body: JSON.stringify(data) });
    return { success: res.ok, status: res.status, data: res.data };
  },
  update: async (id, data) => {
    const res = await apiFetch(`/outbound/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
    return { success: res.ok, status: res.status, data: res.data };
  },
  updateStatus: async (id, status) => {
    const res = await apiFetch(`/outbound/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  inspect: async (id, data = {}) => {
    const res = await apiFetch(`/outbound/${encodeURIComponent(id)}/inspect`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  completeOutbound: async (id, items, notes, options = {}) => {
    const res = await apiFetch(`/outbound/${encodeURIComponent(id)}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ items, notes, ...options }),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  // Konfirmasi pengiriman — deduct stok dari MySQL via backend
  dispatchShipment: async (id, { carrier, tracking_number, items, notes } = {}) => {
    const res = await apiFetch(`/outbound/${encodeURIComponent(id)}/ship`, {
      method: 'POST',
      body: JSON.stringify({ items, carrier, tracking_number, notes }),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  shipOutbound: async (id, items, options = {}) => {
    const res = await apiFetch(`/outbound/${encodeURIComponent(id)}/ship`, {
      method: 'POST',
      body: JSON.stringify({ items, ...options }),
    });
    return { success: res.ok, status: res.status, data: res.data };
  },
  remove: async (id) => {
    const res = await apiFetch(`/outbound/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { success: res.ok, status: res.status, data: res.data };
  },
};

export const usersApi = {
  getAll: async (role = '') => {
    const url = role ? `/users?role=${encodeURIComponent(role)}` : '/users';
    const res = await apiFetch(url);
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },
  getById: async (id) => {
    const res = await apiFetch(`/users/${encodeURIComponent(id)}`);
    return res.ok ? res.data : null;
  },
  createStaff: async ({ name, email, password, role_title, warehouse }) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        role: 'staf',
        role_title: role_title || 'Inventory Staff',
        warehouse: warehouse || 'Main Warehouse',
      }),
    });
    return {
      success: res.ok,
      status: res.status,
      data: res.data,
      userId: res.data?.userId,
      message: res.data?.message,
    };
  },
  update: async (id, data) => {
    const res = await apiFetch(`/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { success: res.ok, status: res.status, data: res.data, message: res.data?.message };
  },
  suspend: async (id) => {
    const res = await apiFetch(`/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return { success: res.ok, status: res.status, data: res.data, message: res.data?.message };
  },
  activate: async (id) => {
    const res = await apiFetch(`/users/${encodeURIComponent(id)}/activate`, {
      method: 'PATCH',
    });
    return { success: res.ok, status: res.status, data: res.data, message: res.data?.message };
  },
  resetPassword: async (email, new_password) => {
    const res = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, new_password }),
    });
    return { success: res.ok, status: res.status, data: res.data, message: res.data?.message };
  },
};
