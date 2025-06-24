import { api } from './index';

export const getDashboardStats = async () => {
  const response = await api.get('/api/admin/dashboard/stats');
  return response.data;
};

export const getAdminRequests = async (params?: {
  page?: number;
  page_size?: number;
  status?: string;
}) => {
  const response = await api.get('/api/admin/requests', { params });
  return response.data;
};

export const deleteRequest = async (id: number) => {
  const response = await api.delete(`/api/admin/requests/${id}`);
  return response.data;
};

export const retryRequest = async (id: number) => {
  const response = await api.post(`/api/admin/requests/${id}/retry`);
  return response.data;
};

export const getLogs = async (params?: {
  page?: number;
  page_size?: number;
  level?: string;
  start_date?: string;
  end_date?: string;
}) => {
  const response = await api.get('/api/admin/logs', { params });
  return response.data;
};

export const clearLogs = async () => {
  const response = await api.delete('/api/admin/logs');
  return response.data;
};

export const getSettings = async () => {
  const response = await api.get('/api/admin/settings');
  return response.data;
};

export const updateSettings = async (settings: any) => {
  const response = await api.put('/api/admin/settings', settings);
  return response.data;
};

export const updateProfile = async (data: {
  username?: string;
  current_password?: string;
  new_password?: string;
}) => {
  const response = await api.put('/api/admin/profile', data);
  return response.data;
};