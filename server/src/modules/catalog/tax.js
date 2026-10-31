/**
 * Calculates tax on a monetary amount using the round-half-up rounding rule.
 *
 * Money rule: amountInt must be an integer in the smallest currency unit (e.g., paise or cents).
 * ratePercent is a percentage from 0 to 100.
 *
 * @param {number} amountInt - Non-negative integer representing the base amount
 * @param {number} ratePercent - Tax rate as a percentage (e.g., 18 for 18%)
 * @returns {number} Tax amount as an integer (smallest unit)
 */
export function calculateTax(amountInt, ratePercent) {
  const amount = Number(amountInt);
  const rate = Number(ratePercent);

  if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
    throw new Error('Invalid amountInt or ratePercent provided to calculateTax');
  }

  if (!Number.isInteger(amount)) {
    throw new Error('amountInt must be an integer in the smallest currency unit (paise or cents)');
  }

  if (amount < 0 || rate < 0) {
    throw new Error('amountInt and ratePercent must be non-negative');
  }

  if (amount === 0 || rate === 0) {
    return 0;
  }

  // To prevent IEEE 754 precision drift before rounding half-up:
  const rawTax = (amount * rate) / 100;
  return Math.round(Number(rawTax.toFixed(8)));
}

/**
 * Calculates line totals including subtotal, tax, and total.
 *
 * All monetary amounts returned are integers in the smallest unit.
 *
 * @param {object} params
 * @param {number} params.unitPrice - Unit price in smallest currency unit (integer)
 * @param {number} [params.qty=1] - Quantity (integer >= 0)
 * @param {number} [params.ratePercent=0] - Tax rate percentage (0 to 100)
 * @returns {{ subtotal: number, tax: number, total: number }}
 */
export function lineTotals({ unitPrice, qty = 1, ratePercent = 0 }) {
  const price = Number(unitPrice);
  const quantity = Number(qty);
  const rate = Number(ratePercent);

  if (!Number.isInteger(price) || price < 0) {
    throw new Error('unitPrice must be a non-negative integer');
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error('qty must be a non-negative integer');
  }

  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error('ratePercent must be a non-negative number');
  }

  const subtotal = price * quantity;
  const tax = calculateTax(subtotal, rate);
  const total = subtotal + tax;

  return {
    subtotal,
    tax,
    total,
  };
}

export default {
  calculateTax,
  lineTotals,
};
