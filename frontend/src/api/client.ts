import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          localStorage.setItem('access_token', data.data.access_token);
          original.headers.Authorization = `Bearer ${data.data.access_token}`;
          return client(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  },
);

export default client;

export const authApi = {
  register: (username: string, email: string, password: string) =>
    client.post('/auth/register', { username, email, password }),

  login: (identifier: string, password: string) =>
    client.post('/auth/login', { identifier, password }),

  refresh: (refresh_token: string) =>
    client.post('/auth/refresh', { refresh_token }),

  changePassword: (old_password: string, new_password: string) =>
    client.post('/auth/change-password', { old_password, new_password }),

  me: () => client.get('/auth/me'),
};

export const ruleTreeApi = {
  getTree: () => client.get('/rule-tree'),

  createCategory: (data: Record<string, unknown>) =>
    client.post('/rule-tree/categories', data),

  updateCategory: (id: string, data: Record<string, unknown>) =>
    client.put(`/rule-tree/categories/${id}`, data),

  deleteCategory: (id: string) =>
    client.delete(`/rule-tree/categories/${id}`),

  createNode: (data: Record<string, unknown>) =>
    client.post('/rule-tree/nodes', data),

  updateNode: (id: string, data: Record<string, unknown>) =>
    client.put(`/rule-tree/nodes/${id}`, data),

  deleteNode: (id: string) =>
    client.delete(`/rule-tree/nodes/${id}`),
};

export const encodeApi = {
  encode: (data: Record<string, unknown>) =>
    client.post('/encode', data),

  check: (partNo: string) =>
    client.post('/encode/check', { part_no: partNo }),

  list: (page = 1, perPage = 20) =>
    client.get(`/encode/list?page=${page}&per_page=${perPage}`),
};

export const adminApi = {
  pendingUsers: () => client.get('/admin/pending-users'),

  approveUser: (userId: string) =>
    client.post(`/admin/approve-user/${userId}`),

  rejectUser: (userId: string) =>
    client.post(`/admin/reject-user/${userId}`),

  issueTempPassword: (userId: string) =>
    client.post(`/admin/issue-temp-password/${userId}`),

  users: (page = 1, perPage = 20) =>
    client.get(`/admin/users?page=${page}&per_page=${perPage}`),

  updateUser: (userId: string, data: Record<string, unknown>) =>
    client.put(`/admin/users/${userId}`, data),

  deleteUser: (userId: string) =>
    client.delete(`/admin/users/${userId}`),

  auditLogs: () => client.get('/admin/audit-logs'),

  passwordResets: () => client.get('/admin/password-resets'),

  approvePasswordReset: (requestId: string) =>
    client.post(`/admin/password-resets/${requestId}/approve`),

  rejectPasswordReset: (requestId: string) =>
    client.post(`/admin/password-resets/${requestId}/reject`),
};
