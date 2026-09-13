/**
 * FULL SYSTEM VERIFICATION
 * ------------------------
 * End-to-end black-box test suite that exercises every route in the app:
 *   - /api/health
 *   - /api/auth        (register, login, me)
 *   - /api/stocks      (list, get, create, update limits)
 *   - /api/accounts    (me, deposit)
 *   - /api/instructions(create, list, get, cancel + every validation rule)
 *   - /api/matching    (order-book, run)
 *   - /api/queries     (user, stock, trades)
 *   - /api/manager     (overview, suspend, outdated-sweep, logs, reset, set-balance)
 *
 * Requires the server to already be running (npm start / npm run dev:server)
 * with a reachable MongoDB, on http://localhost:3000 (override with BASE_URL env var).
 *
 * Run with:  node server/test/fullSystemVerification.js
 */

import assert from 'assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api';

let passCount = 0;
let failCount = 0;

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    }
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  return { status: res.status, ok: res.ok, data };
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

async function check(label, fn) {
  try {
    await fn();
    passCount++;
    console.log(`  [PASS] ${label}`);
  } catch (err) {
    failCount++;
    console.log(`  [FAIL] ${label}`);
    console.log(`         ${err.message}`);
  }
}

async function runAll() {
  console.log('=========================================================');
  console.log('   CTS FULL SYSTEM VERIFICATION (every route, every rule)');
  console.log('=========================================================');

  // ============================================================
  // 0. HEALTH
  // ============================================================
  section('0. Health Check');
  await check('GET /health returns 200 OK', async () => {
    const res = await request('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'OK');
  });

  // ============================================================
  // 1. AUTH
  // ============================================================
  section('1. Authentication (/api/auth)');

  let mgrToken, user1Token, user2Token, user1Id, user2Id;

  await check('Login fails with missing fields (400 MISSING_FIELDS)', async () => {
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'manager@example.com' }) });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'MISSING_FIELDS');
  });

  await check('Login fails for unknown email (401 INVALID_CREDENTIALS)', async () => {
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'nobody@example.com', password: 'x' }) });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.errorCode, 'INVALID_CREDENTIALS');
  });

  await check('Login fails for wrong password (401 INVALID_CREDENTIALS)', async () => {
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'manager@example.com', password: 'wrongpass' }) });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.errorCode, 'INVALID_CREDENTIALS');
  });

  await check('Manager login succeeds and returns SYSTEM_MANAGER role', async () => {
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'manager@example.com', password: 'admin123' }) });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.user.role, 'SYSTEM_MANAGER');
    mgrToken = res.data.data.token;
  });

  await check('User1 (Alice) login succeeds', async () => {
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'user@example.com', password: 'user123' }) });
    assert.strictEqual(res.status, 200);
    user1Token = res.data.data.token;
    user1Id = res.data.data.user.id;
  });

  await check('User2 (Bob) login succeeds', async () => {
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'trader2@example.com', password: 'user123' }) });
    assert.strictEqual(res.status, 200);
    user2Token = res.data.data.token;
    user2Id = res.data.data.user.id;
  });

  const uniqueEmail = `test.user.${Date.now()}@example.com`;
  let newUserToken;
  await check('Register a brand-new user succeeds (201)', async () => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test User', email: uniqueEmail, password: 'testpass123' })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.user.role, 'USER');
    assert.strictEqual(res.data.data.account.availableBalance, 50000.0);
    newUserToken = res.data.data.token;
  });

  await check('Registering the same email again fails (400 USER_ALREADY_EXISTS)', async () => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dup', email: uniqueEmail, password: 'testpass123' })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'USER_ALREADY_EXISTS');
  });

  await check('GET /auth/me with valid token returns matching identity', async () => {
    const res = await request('/auth/me', { headers: { Authorization: `Bearer ${newUserToken}` } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.email, uniqueEmail);
  });

  await check('Request without token is rejected (401 UNAUTHORIZED)', async () => {
    const res = await request('/accounts/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.errorCode, 'UNAUTHORIZED');
  });

  await check('Request with garbage token is rejected (403 FORBIDDEN_TOKEN)', async () => {
    const res = await request('/accounts/me', { headers: { Authorization: 'Bearer not-a-real-token' } });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.errorCode, 'FORBIDDEN_TOKEN');
  });

  await check('Normal user hitting a manager-only route gets 403 (R10)', async () => {
    const res = await request('/manager/overview', { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.errorCode, 'ACCESS_DENIED_ROLE');
  });

  // ============================================================
  // 2. RESET TO CLEAN BASELINE (manager only, so also re-verifies R10)
  // ============================================================
  section('2. Reset to clean baseline');
  await check('Manager resets/reseeds the database (200)', async () => {
    const res = await request('/manager/reset', { method: 'POST', headers: { Authorization: `Bearer ${mgrToken}` } });
    assert.strictEqual(res.status, 200);
  });

  // ============================================================
  // 3. STOCKS (/api/stocks)
  // ============================================================
  section('3. Stocks (/api/stocks)');

  await check('GET /stocks (public/no-auth) lists seeded stocks', async () => {
    const res = await request('/stocks');
    assert.strictEqual(res.status, 200);
    const symbols = res.data.data.map(s => s.stockId);
    assert(symbols.includes('AAPL') && symbols.includes('MSFT'));
  });

  await check('GET /stocks/AAPL returns stock details', async () => {
    const res = await request('/stocks/AAPL');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.stockId, 'AAPL');
  });

  await check('GET /stocks/UNKNOWN returns 404 STOCK_NOT_FOUND', async () => {
    const res = await request('/stocks/UNKNOWN');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.errorCode, 'STOCK_NOT_FOUND');
  });

  await check('Normal user cannot create a stock (403)', async () => {
    const res = await request('/stocks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ symbol: 'NOPE', name: 'Nope Inc', fallingLimit: 1, risingLimit: 2 })
    });
    assert.strictEqual(res.status, 403);
  });

  await check('Manager creating a stock with invalid limits fails (400 INVALID_LIMITS)', async () => {
    const res = await request('/stocks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgrToken}` },
      body: JSON.stringify({ symbol: 'BAD', name: 'Bad Inc', fallingLimit: 100, risingLimit: 50 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'INVALID_LIMITS');
  });

  await check('Manager successfully creates a new stock (201)', async () => {
    const res = await request('/stocks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgrToken}` },
      body: JSON.stringify({ symbol: 'TEST_FULL', name: 'Full Test Stock', fallingLimit: 90, risingLimit: 120 })
    });
    assert.strictEqual(res.status, 201);
  });

  await check('Manager updates price limits on the new stock (200)', async () => {
    const res = await request('/stocks/TEST_FULL/limits', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${mgrToken}` },
      body: JSON.stringify({ fallingLimit: 80, risingLimit: 130 })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.fallingLimit, 80);
  });

  // ============================================================
  // 4. ACCOUNTS (/api/accounts)
  // ============================================================
  section('4. Accounts (/api/accounts)');

  await check('GET /accounts/me returns the caller\'s own account', async () => {
    const res = await request('/accounts/me', { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.userId, user1Id);
  });

  await check('Deposit with a negative amount is rejected (400 INVALID_AMOUNT)', async () => {
    const res = await request('/accounts/deposit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ amount: -50 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'INVALID_AMOUNT');
  });

  await check('Valid deposit increases total and available balance by the same amount', async () => {
    const before = await request('/accounts/me', { headers: { Authorization: `Bearer ${user1Token}` } });
    const res = await request('/accounts/deposit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ amount: 1000 })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.totalBalance, before.data.data.totalBalance + 1000);
    assert.strictEqual(res.data.data.availableBalance, before.data.data.availableBalance + 1000);
  });

  // ============================================================
  // 5. INSTRUCTION VALIDATION (Pretreatment rules)
  // ============================================================
  section('5. Instruction validation rules');

  await check('Missing stockId is rejected (400 MISSING_STOCK_ID)', async () => {
    const res = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ type: 'BUY', quantity: 10, respectedPrice: 100 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'MISSING_STOCK_ID');
  });

  await check('Invalid type is rejected (400 INVALID_TYPE)', async () => {
    const res = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'AAPL', type: 'HOLD', quantity: 10, respectedPrice: 100 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'INVALID_TYPE');
  });

  await check('Non-integer quantity is rejected (400 INVALID_QUANTITY)', async () => {
    const res = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'AAPL', type: 'BUY', quantity: 2.5, respectedPrice: 100 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'INVALID_QUANTITY');
  });

  await check('Zero/negative price is rejected (400 INVALID_PRICE)', async () => {
    const res = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'AAPL', type: 'BUY', quantity: 10, respectedPrice: 0 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'INVALID_PRICE');
  });

  await check('Unknown stock is rejected (400 STOCK_NOT_FOUND)', async () => {
    const res = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'ZZZZ', type: 'BUY', quantity: 10, respectedPrice: 100 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'STOCK_NOT_FOUND');
  });

  await check('Price above rising limit is rejected (R04, 400 RISING_LIMIT_EXCEEDED)', async () => {
    const res = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'AAPL', type: 'BUY', quantity: 10, respectedPrice: 120 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'RISING_LIMIT_EXCEEDED');
  });

  await check('Price below falling limit is rejected (R04, 400 FALLING_LIMIT_EXCEEDED)', async () => {
    const res = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'AAPL', type: 'BUY', quantity: 10, respectedPrice: 80 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'FALLING_LIMIT_EXCEEDED');
  });

  // ============================================================
  // 6. R06 FUND FREEZING + R02 CANCEL + AUTHORIZATION
  // ============================================================
  section('6. R06 Fund freezing, R02 cancel, and cancel authorization');

  let ownedInstructionId;
  await check('Valid BUY freezes exactly qty*price from available balance', async () => {
    const before = await request('/accounts/me', { headers: { Authorization: `Bearer ${user1Token}` } });
    const res = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'MSFT', type: 'BUY', quantity: 5, respectedPrice: 210 })
    });
    assert.strictEqual(res.status, 201);
    ownedInstructionId = res.data.data.instruction.id;
    const after = await request('/accounts/me', { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(after.data.data.availableBalance, before.data.data.availableBalance - 1050);
    assert.strictEqual(after.data.data.frozenBalance, before.data.data.frozenBalance + 1050);
  });

  await check('A different user cannot cancel someone else\'s instruction (400 UNAUTHORIZED_CANCELLATION)', async () => {
    const res = await request(`/instructions/${ownedInstructionId}/cancel`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'UNAUTHORIZED_CANCELLATION');
  });

  await check('GET instruction by id is forbidden for a non-owner, non-manager (403)', async () => {
    const res = await request(`/instructions/${ownedInstructionId}`, { headers: { Authorization: `Bearer ${user2Token}` } });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.errorCode, 'FORBIDDEN');
  });

  await check('GET unknown instruction id returns 404 NOT_FOUND', async () => {
    const res = await request('/instructions/NOT-A-REAL-ID', { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.errorCode, 'NOT_FOUND');
  });

  await check('The owner cancels their own instruction and gets funds released', async () => {
    const res = await request(`/instructions/${ownedInstructionId}/cancel`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.instruction.status, 'CANCELLED');
    assert.strictEqual(res.data.data.releasedFunds, 1050);
  });

  await check('Cancelling an already-cancelled instruction fails (400 ALREADY_CANCELLED)', async () => {
    const res = await request(`/instructions/${ownedInstructionId}/cancel`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'ALREADY_CANCELLED');
  });

  // ============================================================
  // 7. R03 MATCHING ENGINE — PRICE-TIME PRIORITY
  // ============================================================
  section('7. R03 Matching engine (price-first & time-first priority)');

  await check('Price-First: higher BUY price is matched before a lower one', async () => {
    const buyLow = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'TEST_FULL', type: 'BUY', quantity: 50, respectedPrice: 100 })
    });
    const buyHigh = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'TEST_FULL', type: 'BUY', quantity: 50, respectedPrice: 105 })
    });
    const sell = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user2Token}` },
      body: JSON.stringify({ stockId: 'TEST_FULL', type: 'SELL', quantity: 30, respectedPrice: 95 })
    });
    assert.strictEqual(sell.data.data.executedTrades.length, 1);
    assert.strictEqual(sell.data.data.executedTrades[0].buyInstructionId, buyHigh.data.data.instruction.id);
    // cleanup
    await request(`/instructions/${buyLow.data.data.instruction.id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });
    await request(`/instructions/${buyHigh.data.data.instruction.id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });
  });

  await check('Time-First: equal-price BUYs matched in submission order', async () => {
    const t1 = new Date('2026-01-01T10:00:00.000Z').toISOString();
    const t2 = new Date('2026-01-01T10:05:00.000Z').toISOString();
    const buyA = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'TEST_FULL', type: 'BUY', quantity: 40, respectedPrice: 100, timestamp: t1 })
    });
    const buyB = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'TEST_FULL', type: 'BUY', quantity: 40, respectedPrice: 100, timestamp: t2 })
    });
    const sell = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user2Token}` },
      body: JSON.stringify({ stockId: 'TEST_FULL', type: 'SELL', quantity: 20, respectedPrice: 100 })
    });
    assert.strictEqual(sell.data.data.executedTrades[0].buyInstructionId, buyA.data.data.instruction.id);
    await request(`/instructions/${buyA.data.data.instruction.id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });
    await request(`/instructions/${buyB.data.data.instruction.id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });
  });

  // ============================================================
  // 8. ORDER BOOK & MANUAL MATCHING TRIGGER
  // ============================================================
  section('8. Order book & manual "run matching" endpoint');

  await check('Order book sorts SELLs ascending by price, ties by time', async () => {
    const sellHigh = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user2Token}` },
      body: JSON.stringify({ stockId: 'TEST_FULL', type: 'SELL', quantity: 10, respectedPrice: 115 })
    });
    const sellLow = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user2Token}` },
      body: JSON.stringify({ stockId: 'TEST_FULL', type: 'SELL', quantity: 10, respectedPrice: 110 })
    });
    const book = await request('/matching/order-book/TEST_FULL', { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(book.status, 200);
    const prices = book.data.data.sells.map(s => s.respectedPrice);
    const sorted = [...prices].sort((a, b) => a - b);
    assert.deepStrictEqual(prices, sorted, 'Sell side must be ascending by price');
    // cleanup
    await request(`/instructions/${sellHigh.data.data.instruction.id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user2Token}` } });
    await request(`/instructions/${sellLow.data.data.instruction.id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user2Token}` } });
  });

  await check('POST /matching/run reports 0 trades when book has no crossing orders', async () => {
    const res = await request('/matching/run', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'TEST_FULL' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.tradesCount, 0);
  });

  // ============================================================
  // 9. R05 OUTDATED INSTRUCTION SWEEP
  // ============================================================
  section('9. R05 Outdated instruction sweep');

  await check('An instruction older than the threshold is swept to EXPIRED', async () => {
    const old = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({
        stockId: 'AAPL', type: 'BUY', quantity: 4, respectedPrice: 96,
        timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
      })
    });
    const sweep = await request('/manager/outdated-sweep', {
      method: 'POST', headers: { Authorization: `Bearer ${mgrToken}` },
      body: JSON.stringify({ maxAgeHours: 24 })
    });
    assert.strictEqual(sweep.status, 200);
    assert(sweep.data.data.sweptCount >= 1);
    const check1 = await request(`/instructions/${old.data.data.instruction.id}`, { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(check1.data.data.status, 'EXPIRED');
  });

  // ============================================================
  // 10. QUERIES
  // ============================================================
  section('10. Queries (/api/queries)');

  await check('User query returns structured instructions & trades', async () => {
    const res = await request('/queries/user?queryContent=ALL', { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.data.data.data.instructions));
    assert(Array.isArray(res.data.data.data.trades));
  });

  await check('Stock query returns pricing info for AAPL', async () => {
    const res = await request('/queries/stock?stockId=AAPL&queryContent=ALL', { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.stockInfo.stockId, 'AAPL');
  });

  await check('Trades query returns an array', async () => {
    const res = await request('/queries/trades', { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.data.data));
  });

  // ============================================================
  // 11. MANAGER TOOLS
  // ============================================================
  section('11. Manager tools (/api/manager)');

  await check('GET /manager/overview returns system stats', async () => {
    const res = await request('/manager/overview', { headers: { Authorization: `Bearer ${mgrToken}` } });
    assert.strictEqual(res.status, 200);
    assert(typeof res.data.data.stats.totalUsers === 'number');
  });

  await check('GET /manager/logs returns an array of audit log entries', async () => {
    const res = await request('/manager/logs?limit=10', { headers: { Authorization: `Bearer ${mgrToken}` } });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.data.data));
  });

  await check('Manager can set a user\'s balance directly', async () => {
    const res = await request('/manager/set-balance', {
      method: 'POST', headers: { Authorization: `Bearer ${mgrToken}` },
      body: JSON.stringify({ userId: user2Id, availableBalance: 25000, totalBalance: 25000 })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.availableBalance, 25000);
  });

  await check('Suspended operations block new instructions (400 OPERATIONS_SUSPENDED)', async () => {
    await request('/manager/suspend', { method: 'POST', headers: { Authorization: `Bearer ${mgrToken}` }, body: JSON.stringify({ suspended: true }) });
    const res = await request('/instructions', {
      method: 'POST', headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ stockId: 'AAPL', type: 'BUY', quantity: 1, respectedPrice: 100 })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.errorCode, 'OPERATIONS_SUSPENDED');
    await request('/manager/suspend', { method: 'POST', headers: { Authorization: `Bearer ${mgrToken}` }, body: JSON.stringify({ suspended: false }) });
  });

  // ============================================================
  // 12. R06 CONCURRENCY / RACE-CONDITION SAFETY
  // ============================================================
  section('12. R06 Concurrency race-condition safety');

  await check('Two concurrent BUYs that together exceed balance: exactly one succeeds', async () => {
    await request('/manager/set-balance', {
      method: 'POST', headers: { Authorization: `Bearer ${mgrToken}` },
      body: JSON.stringify({ userId: user1Id, availableBalance: 10000, totalBalance: 10000 })
    });
    const [resA, resB] = await Promise.all([
      request('/instructions', { method: 'POST', headers: { Authorization: `Bearer ${user1Token}` }, body: JSON.stringify({ stockId: 'MSFT', type: 'BUY', quantity: 35, respectedPrice: 200 }) }),
      request('/instructions', { method: 'POST', headers: { Authorization: `Bearer ${user1Token}` }, body: JSON.stringify({ stockId: 'MSFT', type: 'BUY', quantity: 35, respectedPrice: 200 }) })
    ]);
    const statuses = [resA.status, resB.status].sort();
    assert.deepStrictEqual(statuses, [201, 400]);
    const acct = await request('/accounts/me', { headers: { Authorization: `Bearer ${user1Token}` } });
    assert.strictEqual(acct.data.data.availableBalance, 3000);
    assert.strictEqual(acct.data.data.frozenBalance, 7000);
    // cleanup: cancel whichever succeeded
    const accepted = resA.status === 201 ? resA.data.data.instruction : resB.data.data.instruction;
    await request(`/instructions/${accepted.id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });
  });

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n=========================================================');
  console.log(`  RESULT: ${passCount} passed, ${failCount} failed (${passCount + failCount} total)`);
  console.log('=========================================================');

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

runAll().catch(err => {
  console.error('Full system verification crashed unexpectedly:', err);
  process.exit(1);
});
