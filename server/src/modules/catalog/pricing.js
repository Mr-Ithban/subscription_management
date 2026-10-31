/**
 * Calculates the unit price of a product, adding any variant extra price.
 * All prices are stored as non-negative integers in the smallest unit (paise or cents).
 *
 * @param {{ salesPrice: number }} product
 * @param {{ extraPrice?: number } | null | undefined} [variant]
 * @returns {number}
 */
export function getUnitPrice(product, variant) {
  if (!product || typeof product.salesPrice !== 'number') {
    throw new Error('Valid product with salesPrice is required');
  }

  return product.salesPrice + (variant?.extraPrice ?? 0);
}
