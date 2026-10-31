const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export function formatMinorCurrency(amount = 0) {
  return inr.format((Number(amount) || 0) / 100);
}
