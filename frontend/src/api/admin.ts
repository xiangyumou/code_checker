import { adminApiClient } from './centralized';

export const getDashboardStats = async () => {
  return adminApiClient.get('/admin/dashboard/stats');
};

export const getAdminRequests = async (params?: {
  page?: number;
  page_size?: number;
  status?: string;
}) => {
  return adminApiClient.get('/admin/requests', { params });
};

export const deleteRequest = async (id: number) => {
  return adminApiClient.delete(`/admin/requests/${id}`);
};

export const retryRequest = async (id: number) => {
  return adminApiClient.post(`/admin/requests/${id}/retry`);
};

export const getLogs = async (params?: {
  page?: number;
  page_size?: number;
  level?: string;
  start_date?: string;
  end_date?: string;
}) => {
  return adminApiClient.get('/admin/logs', { params });
};

export const clearLogs = async () => {
  return adminApiClient.delete('/admin/logs');
};

export const getSettings = async () => {
  return adminApiClient.get('/admin/settings');
};

export const updateSettings = async (settings: Record<string, unknown>) => {
  return adminApiClient.put('/admin/settings', settings);
};

export const updateProfile = async (data: {
  username?: string;
  current_password?: string;
  new_password?: string;
}) => {
  return adminApiClient.put('/admin/profile', data);
};
