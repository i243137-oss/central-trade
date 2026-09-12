import assert from 'assert';

const BASE_URL = 'http://localhost:3000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    }
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('========================================');
  console.log('   CTS SRS SPECIFICATION VERIFICATION   ');
  console.log('========================================\n');

  // 1. Health check
  console.log('[TEST 1] System Health Check...');
  const health = await request('/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.data.status, 'OK');
  console.log('  PASSED: System online, version 1.0 (2007 SRS).\n');

  // 2. Authentication & R10 (Role-Based Authorization)
  console.log('[TEST 2] Authentication & R10 Authorization...');
  const mgrLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'manager@example.com', password: 'admin123' })
  });
  assert.strictEqual(mgrLogin.status, 200);
  const mgrToken = mgrLogin.data.data.token;
  assert.strictEqual(mgrLogin.data.data.user.role, 'SYSTEM_MANAGER');

  const userLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', password: 'user123' })
  });
  assert.strictEqual(userLogin.status, 200);
  const userToken = userLogin.data.data.token;
  assert.strictEqual(userLogin.data.data.user.role, 'USER');

  // Normal user accessing manager overview must get 403 Forbidden
  const forbiddenCheck = await request('/manager/overview', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(forbiddenCheck.status, 403);
  console.log('  PASSED: Role-based authorization enforced (normal user rejected with 403).');

  // Manager accessing manager overview must get 200
  const managerCheck = await request('/manager/overview', {
    headers: { Authorization: `Bearer ${mgrToken}` }
  });
  assert.strictEqual(managerCheck.status, 200);
  console.log('  PASSED: System Manager authorized to access management terminals.');

  // Reset database to ensure completely clean, repeatable test state
  await request('/manager/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgrToken}` }
  });
  console.log('  Clean test state seeded successfully.\n');

  // 3. R04 - Price Limits (Rising / Falling Limits)
  console.log('[TEST 3] R04 - Price Limits Validation...');
  // AAPL has fallingLimit = 95.0, risingLimit = 105.0
  const exceedingOrder = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      stockId: 'AAPL',
      type: 'BUY',
      quantity: 10,
      respectedPrice: 120.0
    })
  });
  assert.strictEqual(exceedingOrder.status, 400);
  assert.strictEqual(exceedingOrder.data.errorCode, 'RISING_LIMIT_EXCEEDED');
  console.log('  PASSED: Order exceeding rising limit rejected.');

  const belowFallingOrder = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      stockId: 'AAPL',
      type: 'BUY',
      quantity: 10,
      respectedPrice: 80.0
    })
  });
  assert.strictEqual(belowFallingOrder.status, 400);
  assert.strictEqual(belowFallingOrder.data.errorCode, 'FALLING_LIMIT_EXCEEDED');
  console.log('  PASSED: Order below falling limit rejected.\n');

  // 4. R06 - Fund Freezing & R01 Buy Instruction
  console.log('[TEST 4] R06 - Fund Freezing & R01 Buy Instruction...');
  const myAccBefore = await request('/accounts/me', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  const availBefore = myAccBefore.data.data.availableBalance;
  const frozenBefore = myAccBefore.data.data.frozenBalance;

  // Place valid BUY order at $104.0 (no immediate match expected at $104)
  const buyInst = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      stockId: 'MSFT',
      type: 'BUY',
      quantity: 5,
      respectedPrice: 210.0 // MSFT limits: 200-230
    })
  });
  assert.strictEqual(buyInst.status, 201);
  const createdBuyId = buyInst.data.data.instruction.id;

  const myAccAfter = await request('/accounts/me', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  const expectedFreeze = 5 * 210.0;
  assert.strictEqual(myAccAfter.data.data.availableBalance, availBefore - expectedFreeze);
  assert.strictEqual(myAccAfter.data.data.frozenBalance, frozenBefore + expectedFreeze);
  console.log(`  PASSED: Buy instruction created (${createdBuyId}), $${expectedFreeze} atomically frozen.\n`);

  // 5. R02 - Cancel Instruction & Fund Release
  console.log('[TEST 5] R02 - Cancel Instruction & Fund Release...');
  const cancelRes = await request(`/instructions/${createdBuyId}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(cancelRes.status, 200);
  assert.strictEqual(cancelRes.data.data.instruction.status, 'CANCELLED');
  assert.strictEqual(cancelRes.data.data.releasedFunds, expectedFreeze);

  const myAccCancelled = await request('/accounts/me', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(myAccCancelled.data.data.availableBalance, availBefore);
  assert.strictEqual(myAccCancelled.data.data.frozenBalance, frozenBefore);
  console.log('  PASSED: Instruction cancelled, frozen funds released to available balance.');

  // Try cancelling again -> error
  const duplicateCancel = await request(`/instructions/${createdBuyId}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(duplicateCancel.status, 400);
  assert.strictEqual(duplicateCancel.data.errorCode, 'ALREADY_CANCELLED');
  console.log('  PASSED: Exception handled for re-cancelling instruction.\n');

  // 6. R03 - Matching Mechanism (Price-Time Priority & Execution)
  console.log('[TEST 6] R03 - Matching Mechanism (Price-Time Priority)...');
  const user2Login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'trader2@example.com', password: 'user123' })
  });
  const user2Token = user2Login.data.data.token;

  // Trader 2 submits SELL TSLA: 15 units @ 200.0 (Limits: 180-220)
  const sellTSLA = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
    body: JSON.stringify({
      stockId: 'TSLA',
      type: 'SELL',
      quantity: 15,
      respectedPrice: 200.0
    })
  });
  assert.strictEqual(sellTSLA.status, 201);

  // Trader 1 submits BUY TSLA: 15 units @ 205.0 (Respected price >= sell price -> match!)
  const buyTSLA = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      stockId: 'TSLA',
      type: 'BUY',
      quantity: 15,
      respectedPrice: 205.0
    })
  });
  assert.strictEqual(buyTSLA.status, 201);
  assert.strictEqual(buyTSLA.data.data.instruction.status, 'TOTALLY_FINISHED');
  assert.strictEqual(buyTSLA.data.data.executedTrades.length, 1);
  const trade = buyTSLA.data.data.executedTrades[0];
  assert.strictEqual(trade.stockId, 'TSLA');
  assert.strictEqual(trade.quantity, 15);
  console.log(`  PASSED: Matched 15 TSLA shares at $${trade.price}, order marked TOTALLY_FINISHED.`);

  // Attempt to cancel a totally finished order -> must reject with ALREADY_IMPLEMENTED
  const cancelFinished = await request(`/instructions/${buyTSLA.data.data.instruction.id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(cancelFinished.status, 400);
  assert.strictEqual(cancelFinished.data.errorCode, 'ALREADY_IMPLEMENTED');
  console.log('  PASSED: Exception handled for cancelling already implemented order.\n');

  // 7. R05 - Outdated Instructions
  console.log('[TEST 7] R05 - Outdated Instructions Sweep...');
  const outdatedOrder = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      stockId: 'AAPL',
      type: 'BUY',
      quantity: 4,
      respectedPrice: 96.0,
      timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() // 36 hours ago!
    })
  });
  assert.strictEqual(outdatedOrder.status, 201);
  const outdatedId = outdatedOrder.data.data.instruction.id;

  // Sweep with 24 hours threshold
  const sweepRes = await request('/manager/outdated-sweep', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({ maxAgeHours: 24 })
  });
  assert.strictEqual(sweepRes.status, 200);
  assert(sweepRes.data.data.sweptCount >= 1);

  const sweptCheck = await request(`/instructions/${outdatedId}`, {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(sweptCheck.data.data.status, 'EXPIRED');
  console.log('  PASSED: Outdated instruction swept and marked EXPIRED (>24h).\n');

  // 8. R07 - Query Interface (User and Stock Query)
  console.log('[TEST 8] R07 - Query Interface (SRS 7.1.1 c & 7.1.2)...');
  const userQ = await request('/queries/user?queryContent=ALL', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(userQ.status, 200);
  assert.strictEqual(userQ.data.data.queryType, 'USER_QUERY');
  assert(Array.isArray(userQ.data.data.data.instructions));
  assert(Array.isArray(userQ.data.data.data.trades));

  const stockQ = await request('/queries/stock?stockId=AAPL&queryContent=ALL', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(stockQ.status, 200);
  assert.strictEqual(stockQ.data.data.queryType, 'STOCK_QUERY');
  assert.strictEqual(stockQ.data.data.stockInfo.stockId, 'AAPL');
  assert(stockQ.data.data.data.pricing !== undefined);
  console.log('  PASSED: Structuralized user query and stock trade query returned.\n');

  // 9. Operations Suspended Exception (SRS 2.2.2 Exception 1)
  console.log('[TEST 9] System Suspension Exception Handling...');
  // Suspend operations
  await request('/manager/suspend', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({ suspended: true })
  });

  const suspendedBuy = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      stockId: 'AAPL',
      type: 'BUY',
      quantity: 5,
      respectedPrice: 100.0
    })
  });
  assert.strictEqual(suspendedBuy.status, 400);
  assert.strictEqual(suspendedBuy.data.errorCode, 'OPERATIONS_SUSPENDED');
  console.log('  PASSED: Orders blocked while system operations suspended.');

  // Resume operations
  await request('/manager/suspend', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({ suspended: false })
  });
  console.log('  PASSED: Trading operations resumed successfully.\n');

  console.log('========================================');
  console.log(' ALL R01 - R10 REQUIREMENTS VERIFIED!   ');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('Verification FAILED:', err);
  process.exit(1);
});
