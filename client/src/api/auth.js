import api from './client';
export { clearStoredToken, getStoredToken, storeToken } from '../auth/token';

export async function loginRequest(credentials) {
  const response = await api.post('/api/auth/login', credentials);
  return response.data;
}

export async function signupRequest(details) {
  const response = await api.post('/api/auth/signup', details);
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get('/api/auth/me');
  return response.data;
}

export async function requestPasswordReset(email) {
  const response = await api.post('/api/auth/forgot-password', { email });
  return response.data;
}

export async function resetPassword(payload) {
  const response = await api.post('/api/auth/reset-password', payload);
  return response.data;
}
