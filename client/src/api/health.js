import api from './client';

export const getHealthStatus = async () => {
  const response = await api.get('/api/health');
  return response.data;
};
