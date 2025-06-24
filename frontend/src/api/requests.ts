import { api } from './index';

export interface CreateRequestData {
  text: string;
  images: string[];
}

export const createRequest = async (data: CreateRequestData) => {
  const response = await api.post('/api/requests', {
    user_input: data.text,
    uploaded_images: data.images,
  });
  return response.data;
};

export const getRequests = async () => {
  const response = await api.get('/api/requests');
  return response.data;
};

export const getRequestDetail = async (id: number) => {
  const response = await api.get(`/api/requests/${id}`);
  return response.data;
};

export const regenerateAnalysis = async (id: number) => {
  const response = await api.post(`/api/requests/${id}/regenerate`);
  return response.data;
};