/**
 * Calculates the next billing date given a starting date and a billing period cadence.
 *
 * Supported cadences:
 * - DAILY:   +1 calendar day
 * - WEEKLY:  +7 calendar days
 * - MONTHLY: +1 calendar month, clamped to the last valid day of the target month
 *            (e.g., Jan 31 -> Feb 28 in non-leap year, Feb 29 in leap year)
 * - YEARLY:  +1 calendar year, clamped to month end for leap year adjustments (Feb 29 -> Feb 28)
 *
 * @param {Date | string | number} fromDate - Starting date
 * @param {'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'} billingPeriod - Cadence
 * @returns {Date} The calculated next billing date
 */
export function getNextBillingDate(fromDate, billingPeriod) {
  const date = new Date(fromDate);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid fromDate provided');
  }

  const period = String(billingPeriod).toUpperCase();

  switch (period) {
    case 'DAILY': {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      return next;
    }

    case 'WEEKLY': {
      const next = new Date(date);
      next.setDate(next.getDate() + 7);
      return next;
    }

    case 'MONTHLY': {
      const currentYear = date.getFullYear();
      const currentMonth = date.getMonth();
      const currentDay = date.getDate();

      // Determine target month and year
      const targetMonthRaw = currentMonth + 1;
      const targetYear = currentYear + Math.floor(targetMonthRaw / 12);
      const targetMonth = targetMonthRaw % 12;

      // Number of days in target month (day 0 of month+1 gives last day of month)
      const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const clampedDay = Math.min(currentDay, daysInTargetMonth);

      const next = new Date(date);
      next.setFullYear(targetYear, targetMonth, clampedDay);
      return next;
    }

    case 'YEARLY': {
      const currentYear = date.getFullYear();
      const currentMonth = date.getMonth();
      const currentDay = date.getDate();

      const targetYear = currentYear + 1;
      const daysInTargetMonth = new Date(targetYear, currentMonth + 1, 0).getDate();
      const clampedDay = Math.min(currentDay, daysInTargetMonth);

      const next = new Date(date);
      next.setFullYear(targetYear, currentMonth, clampedDay);
      return next;
    }

    default:
      throw new Error(`Invalid billingPeriod: ${billingPeriod}. Expected DAILY, WEEKLY, MONTHLY, or YEARLY.`);
  }
}
