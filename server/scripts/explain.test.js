import { parseExplainPlan } from './explain.js';

describe('M4-5 Query Explain & Index Analyzer', () => {
  it('detects index scan when query plan uses index', () => {
    const rows = [
      { 'QUERY PLAN': 'Bitmap Heap Scan on "Invoice"  (cost=4.30..15.20 rows=5 width=120)' },
      { 'QUERY PLAN': '  Recheck Cond: ("status" = \'CONFIRMED\'::"InvoiceStatus" AND "dueDate" < now())' },
      { 'QUERY PLAN': '  ->  Bitmap Index Scan on "Invoice_status_dueDate_idx"  (cost=0.00..4.30 rows=5 width=0)' },
    ];

    const result = parseExplainPlan(rows, 'Invoice_status_dueDate_idx');
    expect(result.indexUsed).toBe(true);
    expect(result.isSeqScan).toBe(false);
  });

  it('detects sequential scan on unindexed or empty table', () => {
    const rows = [
      { 'QUERY PLAN': 'Seq Scan on "Product"  (cost=0.00..1.20 rows=1 width=80)' },
      { 'QUERY PLAN': '  Filter: ("name" = \'Test\'::text)' },
    ];

    const result = parseExplainPlan(rows, 'Product_name_idx');
    expect(result.indexUsed).toBe(false);
    expect(result.isSeqScan).toBe(true);
  });

  it('detects direct index scan using index name', () => {
    const rows = [
      { 'QUERY PLAN': 'Index Scan using "Product_name_idx" on "Product"  (cost=0.15..8.17 rows=1 width=80)' },
    ];

    const result = parseExplainPlan(rows, 'Product_name_idx');
    expect(result.indexUsed).toBe(true);
  });
});
