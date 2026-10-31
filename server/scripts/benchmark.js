/**
 * API Endpoint Performance Benchmark — Milestone M4-6
 *
 * Logs in as an administrator, times key listing and reporting endpoints,
 * and asserts that every endpoint responds within the 2,000ms SLA.
 *
 * Usage:
 *   node scripts/benchmark.js [baseUrl]
 *   npm run benchmark
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import dotenv from 'dotenv';
import app from '../src/app.js';

dotenv.config();

export const SLA_THRESHOLD_MS = 2000;

export const BENCHMARK_ENDPOINTS = [
  { name: 'Products List', path: '/api/products?page=1&limit=20' },
  { name: 'Payments List', path: '/api/payments?page=1&limit=20' },
  { name: 'Reports Summary', path: '/api/reports/summary?skipCache=true' },
  { name: 'Reports Revenue (Monthly)', path: '/api/reports/revenue?groupBy=month' },
  { name: 'Reports Revenue (Weekly)', path: '/api/reports/revenue?groupBy=week' },
  { name: 'Reports Subscriptions List', path: '/api/reports/subscriptions?page=1&limit=20' },
  { name: 'Reports Overdue Invoices', path: '/api/reports/overdue?page=1&limit=20' },
];

/**
 * Obtains an admin authentication token.
 * Generates a valid signed JWT using the environment secret.
 */
export function getAdminToken() {
  const secret = process.env.JWT_SECRET || 'brightloop-benchmark-secret';
  return jwt.sign(
    {
      id: 'usr_admin_benchmark',
      email: 'admin@brightloop.test',
      role: 'ADMIN',
    },
    secret,
    { expiresIn: '1h' }
  );
}

/**
 * Benchmarks a list of endpoints against the Express application or remote URL.
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl]
 * @param {string} [options.token]
 * @param {number} [options.slaMs]
 * @returns {Promise<{ passed: boolean; results: object[] }>}
 */
export async function runBenchmark({
  baseUrl,
  token = getAdminToken(),
  slaMs = SLA_THRESHOLD_MS,
} = {}) {
  const results = [];
  let allPassed = true;

  for (const ep of BENCHMARK_ENDPOINTS) {
    const t0 = performance.now();
    let status = 0;
    let error = null;

    try {
      if (baseUrl) {
        const url = `${baseUrl.replace(/\/$/, '')}${ep.path}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        status = res.status;
      } else {
        const res = await request(app)
          .get(ep.path)
          .set('Authorization', `Bearer ${token}`);
        status = res.status;
      }
    } catch (err) {
      error = err.message;
    }

    const duration = Math.round(performance.now() - t0);
    const passed = !error && duration <= slaMs;

    if (!passed) {
      allPassed = false;
    }

    results.push({
      name: ep.name,
      path: ep.path,
      status,
      durationMs: duration,
      passed,
      error,
    });
  }

  return { passed: allPassed, results };
}

async function cli() {
  console.log('='.repeat(75));
  console.log('Brightloop API Performance Benchmark (Milestone M4-6)');
  console.log(`SLA Threshold: ${SLA_THRESHOLD_MS} ms`);
  console.log('='.repeat(75));

  const targetUrl = process.argv[2] || process.env.BENCHMARK_TARGET_URL;
  if (targetUrl) {
    console.log(`Testing target: ${targetUrl}\n`);
  } else {
    console.log(`Testing local application instance in-process\n`);
  }

  const { passed, results } = await runBenchmark({ baseUrl: targetUrl });

  console.log(
    'Endpoint'.padEnd(32) +
      'Status'.padEnd(10) +
      'Duration'.padEnd(14) +
      'Result'
  );
  console.log('-'.repeat(75));

  for (const r of results) {
    const statusStr = r.status ? String(r.status) : 'ERR';
    const durStr = `${r.durationMs} ms`;
    const resultStr = r.passed ? '✅ PASS' : `❌ FAIL (> ${SLA_THRESHOLD_MS}ms)`;

    console.log(
      r.name.padEnd(32) +
        statusStr.padEnd(10) +
        durStr.padEnd(14) +
        resultStr
    );
  }

  console.log('='.repeat(75));

  if (!passed) {
    console.error('Benchmark FAILED: One or more endpoints violated the SLA threshold.');
    process.exit(1);
  }

  console.log('Benchmark PASSED: All endpoints responded within SLA threshold.');
  process.exit(0);
}

if (process.argv[1]?.endsWith('benchmark.js')) {
  cli().catch((err) => {
    console.error('Benchmark execution error:', err);
    process.exit(1);
  });
}
