import api from './client';

export function getSessionToken() {
  try {
    return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  } catch {
    return '';
  }
}

function authConfig(extra = {}) {
  const token = getSessionToken();
  return {
    ...extra,
    headers: { ...extra.headers, ...(token && { Authorization: `Bearer ${token}` }) },
  };
}

export const getStaffSubscriptions = async () => (await api.get('/api/subscriptions?limit=50', authConfig())).data;
export const getStaffInvoices = async () => (await api.get('/api/invoices?limit=50', authConfig())).data;
export const getPortalSubscriptions = async () => (await api.get('/api/portal/subscriptions', authConfig())).data;
export const getPortalInvoices = async () => (await api.get('/api/portal/invoices', authConfig())).data;

export async function runSubscriptionAction(id, action) {
  return (await api.post(`/api/subscriptions/${encodeURIComponent(id)}/${action}`, {}, authConfig())).data;
}

export async function runInvoiceAction(id, action) {
  return (await api.post(`/api/invoices/${encodeURIComponent(id)}/${action}`, {}, authConfig())).data;
}

export async function downloadInvoicePdf(id, portal = false) {
  const path = portal
    ? `/api/portal/invoices/${encodeURIComponent(id)}/pdf`
    : `/api/invoices/${encodeURIComponent(id)}/pdf`;
  const response = await api.get(path, authConfig({ responseType: 'blob' }));
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `invoice-${id}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getRequestError(error) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Request failed';
}
