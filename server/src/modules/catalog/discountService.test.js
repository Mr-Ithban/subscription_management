import { jest } from '@jest/globals';
import {
  getApplicableDiscounts,
  computeDiscountAmount,
  incrementUsage,
} from './discountService.js';

describe('Discount Applicability Service (src/modules/catalog/discountService.js)', () => {
  const referenceDate = new Date('2024-06-15T12:00:00.000Z');

  describe('getApplicableDiscounts', () => {
    const validSubscriptionDiscount = {
      id: 'disc-sub-1',
      name: 'Sitewide 10%',
      type: 'PERCENT',
      value: 10,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2024-12-31T23:59:59.000Z'),
      usageLimit: 100,
      usedCount: 10,
      minPurchase: 1000,
      minQty: 2,
      appliesTo: 'SUBSCRIPTION',
      productId: null,
      active: true,
    };

    const validProductDiscount = {
      id: 'disc-prod-1',
      name: 'Widget 20% Off',
      type: 'PERCENT',
      value: 20,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2024-12-31T23:59:59.000Z'),
      usageLimit: 50,
      usedCount: 5,
      minPurchase: 500,
      minQty: 1,
      appliesTo: 'PRODUCT',
      productId: 'prod-widget',
      active: true,
    };

    it('returns applicable discounts when all criteria are satisfied', async () => {
      const lines = [
        { productId: 'prod-widget', unitPrice: 1000, qty: 2, subtotal: 2000 },
      ];

      const result = await getApplicableDiscounts({
        discounts: [validSubscriptionDiscount, validProductDiscount],
        lines,
        subtotal: 2000,
        totalQty: 2,
        date: referenceDate,
      });

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toEqual(['disc-sub-1', 'disc-prod-1']);
    });

    describe('Edge Cases: Date Range', () => {
      it('excludes expired discount (date after endDate)', async () => {
        const expiredDiscount = {
          ...validSubscriptionDiscount,
          id: 'disc-expired',
          endDate: new Date('2024-05-01T00:00:00.000Z'), // in past
        };

        const result = await getApplicableDiscounts({
          discounts: [expiredDiscount],
          lines: [{ productId: 'prod-1', unitPrice: 5000, qty: 5 }],
          date: referenceDate,
        });

        expect(result).toHaveLength(0);
      });

      it('excludes not started discount (date before startDate)', async () => {
        const notStartedDiscount = {
          ...validSubscriptionDiscount,
          id: 'disc-not-started',
          startDate: new Date('2024-07-01T00:00:00.000Z'), // in future
        };

        const result = await getApplicableDiscounts({
          discounts: [notStartedDiscount],
          lines: [{ productId: 'prod-1', unitPrice: 5000, qty: 5 }],
          date: referenceDate,
        });

        expect(result).toHaveLength(0);
      });

      it('includes discount on exact boundary dates (startDate and endDate inclusive)', async () => {
        const boundaryDiscount = {
          ...validSubscriptionDiscount,
          startDate: new Date('2024-06-15T00:00:00.000Z'),
          endDate: new Date('2024-06-15T23:59:59.000Z'),
        };

        const result = await getApplicableDiscounts({
          discounts: [boundaryDiscount],
          lines: [{ productId: 'prod-1', unitPrice: 2000, qty: 2 }],
          date: new Date('2024-06-15T12:00:00.000Z'),
        });

        expect(result).toHaveLength(1);
      });
    });

    describe('Edge Cases: Usage Limit', () => {
      it('excludes exhausted discount (usedCount >= usageLimit)', async () => {
        const exhaustedDiscount = {
          ...validSubscriptionDiscount,
          id: 'disc-exhausted',
          usageLimit: 25,
          usedCount: 25,
        };

        const result = await getApplicableDiscounts({
          discounts: [exhaustedDiscount],
          lines: [{ productId: 'prod-1', unitPrice: 5000, qty: 5 }],
          date: referenceDate,
        });

        expect(result).toHaveLength(0);
      });

      it('includes discount when usageLimit is null (unlimited usage)', async () => {
        const unlimitedDiscount = {
          ...validSubscriptionDiscount,
          id: 'disc-unlimited',
          usageLimit: null,
          usedCount: 9999,
        };

        const result = await getApplicableDiscounts({
          discounts: [unlimitedDiscount],
          lines: [{ productId: 'prod-1', unitPrice: 5000, qty: 5 }],
          date: referenceDate,
        });

        expect(result).toHaveLength(1);
      });
    });

    describe('Edge Cases: Below Minimums (minPurchase & minQty)', () => {
      it('excludes SUBSCRIPTION discount when subtotal is below minPurchase', async () => {
        const minPurchaseDiscount = {
          ...validSubscriptionDiscount,
          minPurchase: 5000, // Requires 5000 paise
        };

        const result = await getApplicableDiscounts({
          discounts: [minPurchaseDiscount],
          lines: [{ productId: 'prod-1', unitPrice: 1000, qty: 2 }], // Subtotal = 2000
          subtotal: 2000,
          totalQty: 2,
          date: referenceDate,
        });

        expect(result).toHaveLength(0);
      });

      it('excludes SUBSCRIPTION discount when totalQty is below minQty', async () => {
        const minQtyDiscount = {
          ...validSubscriptionDiscount,
          minQty: 5, // Requires 5 items
        };

        const result = await getApplicableDiscounts({
          discounts: [minQtyDiscount],
          lines: [{ productId: 'prod-1', unitPrice: 1000, qty: 3 }], // Qty = 3
          subtotal: 3000,
          totalQty: 3,
          date: referenceDate,
        });

        expect(result).toHaveLength(0);
      });

      it('excludes PRODUCT discount when matching product subtotal is below minPurchase', async () => {
        const minProductDiscount = {
          ...validProductDiscount,
          productId: 'prod-widget',
          minPurchase: 3000, // Requires 3000 on widgets
        };

        const lines = [
          { productId: 'prod-widget', unitPrice: 1000, qty: 2, subtotal: 2000 },
          { productId: 'prod-other', unitPrice: 5000, qty: 1, subtotal: 5000 }, // Total subtotal is 7000, but widget subtotal is only 2000
        ];

        const result = await getApplicableDiscounts({
          discounts: [minProductDiscount],
          lines,
          subtotal: 7000,
          totalQty: 3,
          date: referenceDate,
        });

        expect(result).toHaveLength(0);
      });

      it('excludes PRODUCT discount when matching product qty is below minQty', async () => {
        const minProductQtyDiscount = {
          ...validProductDiscount,
          productId: 'prod-widget',
          minQty: 3, // Requires 3 widgets
        };

        const lines = [
          { productId: 'prod-widget', unitPrice: 1000, qty: 2, subtotal: 2000 },
          { productId: 'prod-other', unitPrice: 1000, qty: 5, subtotal: 5000 },
        ];

        const result = await getApplicableDiscounts({
          discounts: [minProductQtyDiscount],
          lines,
          date: referenceDate,
        });

        expect(result).toHaveLength(0);
      });
    });

    describe('Product vs Subscription Scope', () => {
      it('PRODUCT discount applies to matching lines only and excludes non-matching products', async () => {
        const widgetDiscount = { ...validProductDiscount, productId: 'prod-widget' };
        const gadgetDiscount = { ...validProductDiscount, id: 'disc-gadget', productId: 'prod-gadget' };

        // Order contains only widgets, not gadgets
        const lines = [
          { productId: 'prod-widget', unitPrice: 1000, qty: 2, subtotal: 2000 },
        ];

        const result = await getApplicableDiscounts({
          discounts: [widgetDiscount, gadgetDiscount],
          lines,
          date: referenceDate,
        });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('disc-prod-1');
      });

      it('calculates subtotal and totalQty from lines if not passed directly', async () => {
        const lines = [
          { productId: 'prod-widget', unitPrice: 1500, qty: 2 }, // 3000
          { productId: 'prod-other', unitPrice: 2000, qty: 1 },  // 2000 -> Total 5000, Qty 3
        ];

        const result = await getApplicableDiscounts({
          discounts: [validSubscriptionDiscount],
          lines,
          date: referenceDate,
        });

        expect(result).toHaveLength(1);
      });

      it('queries Prisma for active discounts when discounts parameter is omitted', async () => {
        const mockPrisma = {
          discount: {
            findMany: jest.fn().mockResolvedValue([validSubscriptionDiscount]),
          },
        };

        const lines = [{ productId: 'prod-widget', unitPrice: 1000, qty: 2 }];

        const result = await getApplicableDiscounts({
          lines,
          date: referenceDate,
          prisma: mockPrisma,
        });

        expect(result).toHaveLength(1);
        expect(mockPrisma.discount.findMany).toHaveBeenCalledWith({
          where: { active: true },
          include: { product: true },
        });
      });
    });
  });

  describe('computeDiscountAmount(discount, baseAmount)', () => {
    describe('FIXED discounts', () => {
      it('caps at base amount when FIXED discount value is greater than base', () => {
        const discount = { type: 'FIXED', value: 5000 }; // Rs 50
        const baseAmount = 3000; // Rs 30

        const amount = computeDiscountAmount(discount, baseAmount);
        expect(amount).toBe(3000); // Caps at baseAmount (never exceeds)
        expect(Number.isInteger(amount)).toBe(true);
      });

      it('returns exact discount value when FIXED discount value is less than base', () => {
        const discount = { type: 'FIXED', value: 1000 };
        const baseAmount = 3000;

        const amount = computeDiscountAmount(discount, baseAmount);
        expect(amount).toBe(1000);
      });

      it('returns base amount when FIXED discount value equals base', () => {
        const discount = { type: 'FIXED', value: 2500 };
        const baseAmount = 2500;

        const amount = computeDiscountAmount(discount, baseAmount);
        expect(amount).toBe(2500);
      });
    });

    describe('PERCENT discounts (round-half-up)', () => {
      it('computes percentage correctly (18% on 1000 = 180)', () => {
        const discount = { type: 'PERCENT', value: 18 };
        const amount = computeDiscountAmount(discount, 1000);
        expect(amount).toBe(180);
      });

      it('rounds half up: 15% on 90 (13.5 -> 14)', () => {
        const discount = { type: 'PERCENT', value: 15 };
        const amount = computeDiscountAmount(discount, 90);
        expect(amount).toBe(14);
      });

      it('rounds half up: 10% on 45 (4.5 -> 5)', () => {
        const discount = { type: 'PERCENT', value: 10 };
        const amount = computeDiscountAmount(discount, 45);
        expect(amount).toBe(5);
      });

      it('rounds down when fractional part is less than 0.5: 10% on 44 (4.4 -> 4)', () => {
        const discount = { type: 'PERCENT', value: 10 };
        const amount = computeDiscountAmount(discount, 44);
        expect(amount).toBe(4);
      });

      it('caps 100% discount to exact base amount', () => {
        const discount = { type: 'PERCENT', value: 100 };
        const amount = computeDiscountAmount(discount, 5000);
        expect(amount).toBe(5000);
      });
    });

    describe('Edge Cases', () => {
      it('returns 0 when baseAmount is 0 or negative', () => {
        const discount = { type: 'PERCENT', value: 20 };
        expect(computeDiscountAmount(discount, 0)).toBe(0);
        expect(computeDiscountAmount(discount, -500)).toBe(0);
      });

      it('throws error for unsupported discount type', () => {
        const discount = { type: 'TIERED', value: 10 };
        expect(() => computeDiscountAmount(discount, 1000)).toThrow('Unsupported discount type');
      });
    });
  });

  describe('incrementUsage(tx, discountId)', () => {
    it('atomically increments usedCount when discount is under limit', async () => {
      const mockTx = {
        discount: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'disc-1',
            usageLimit: 10,
            usedCount: 5,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const result = await incrementUsage(mockTx, 'disc-1');

      expect(result).toEqual({
        success: true,
        discountId: 'disc-1',
        usedCount: 6,
      });

      expect(mockTx.discount.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'disc-1',
          usedCount: {
            lt: 10,
          },
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });
    });

    it('successfully increments when usageLimit is null (unlimited)', async () => {
      const mockTx = {
        discount: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'disc-unlimited',
            usageLimit: null,
            usedCount: 50,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const result = await incrementUsage(mockTx, 'disc-unlimited');

      expect(result.success).toBe(true);
      expect(result.usedCount).toBe(51);
      expect(mockTx.discount.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'disc-unlimited',
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });
    });

    it('throws 409 conflict when discount is already exhausted before update', async () => {
      const mockTx = {
        discount: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'disc-exhausted',
            usageLimit: 10,
            usedCount: 10,
          }),
          updateMany: jest.fn(),
        },
      };

      await expect(incrementUsage(mockTx, 'disc-exhausted')).rejects.toThrow(
        'Discount usage limit has been reached'
      );
      expect(mockTx.discount.updateMany).not.toHaveBeenCalled();
    });

    it('throws 409 conflict when concurrent update consumes the last use (count === 0)', async () => {
      const mockTx = {
        discount: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'disc-race',
            usageLimit: 10,
            usedCount: 9,
          }),
          // Another transaction won the race, so this update matched 0 rows
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      await expect(incrementUsage(mockTx, 'disc-race')).rejects.toThrow(
        'Discount usage limit has been reached'
      );
    });

    it('throws 404 if discount is not found', async () => {
      const mockTx = {
        discount: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      await expect(incrementUsage(mockTx, 'non-existent')).rejects.toThrow(
        'Discount not found'
      );
    });
  });
});
