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

async function runDeepVerification() {
  console.log('===========================================================');
  console.log('   CTS R03 MATCHING & R06 CONCURRENCY DEEP VERIFICATION    ');
  console.log('===========================================================\n');

  // Authenticate System Manager
  const mgrLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'manager@example.com', password: 'admin123' })
  });
  assert.strictEqual(mgrLogin.status, 200);
  const mgrToken = mgrLogin.data.data.token;

  // Authenticate User 1 (user@example.com)
  const user1Login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', password: 'user123' })
  });
  assert.strictEqual(user1Login.status, 200);
  const user1Token = user1Login.data.data.token;
  const user1Id = user1Login.data.data.user.id;

  // Authenticate User 2 (trader2@example.com)
  const user2Login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'trader2@example.com', password: 'user123' })
  });
  assert.strictEqual(user2Login.status, 200);
  const user2Token = user2Login.data.data.token;
  const user2Id = user2Login.data.data.user.id;

  // Reset database to ensure clean, isolated state
  await request('/manager/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgrToken}` }
  });
  console.log('[SETUP] Academic database reset to clean baseline.');

  // Create clean dedicated stock for R03 testing with zero prior orders
  await request('/stocks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      symbol: 'TEST_R03',
      name: 'R03 Priority Test Stock',
      fallingLimit: 90.0,
      risingLimit: 120.0
    })
  });
  console.log('[SETUP] Created dedicated TEST_R03 stock (Limits: 90.0 - 120.0) with clean order book.\n');

  // =========================================================================
  // TEST SUITE 1: R03 Price Priority Execution Testing
  // BUY 100 @ 102 vs BUY 100 @ 105, followed by SELL 50 @ 100.
  // The matching engine MUST match the higher BUY order (105) first!
  // =========================================================================
  console.log('[TEST 1] R03 - Price-First Priority Verification...');
  
  // Submit Buyer Order 1: 100 @ 102
  const buy102Res = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      type: 'BUY',
      quantity: 100,
      respectedPrice: 102.0
    })
  });
  assert.strictEqual(buy102Res.status, 201);
  const buy102Id = buy102Res.data.data.instruction.id;

  // Submit Buyer Order 2: 100 @ 105 (Submitted after order 1, but with HIGHER price)
  const buy105Res = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      type: 'BUY',
      quantity: 100,
      respectedPrice: 105.0
    })
  });
  assert.strictEqual(buy105Res.status, 201);
  const buy105Id = buy105Res.data.data.instruction.id;

  // Submit Seller Order: 50 @ 100 (from Trader 2)
  const sell50Res = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      type: 'SELL',
      quantity: 50,
      respectedPrice: 100.0
    })
  });
  assert.strictEqual(sell50Res.status, 201);
  const executedTrades = sell50Res.data.data.executedTrades;
  assert.strictEqual(executedTrades.length, 1);
  
  const trade = executedTrades[0];
  console.log(`  -> Match executed: ${trade.quantity} units @ $${trade.price} between Buy: ${trade.buyInstructionId} & Sell: ${trade.sellInstructionId}`);
  assert.strictEqual(trade.buyInstructionId, buy105Id, 'Price-First violation: Lower-priced order matched instead of highest price!');
  assert.strictEqual(trade.quantity, 50);

  // Inspect status of BUY 105 -> must be PARTIALLY_FINISHED with remainingQuantity = 50
  const check105 = await request(`/instructions/${buy105Id}`, {
    headers: { Authorization: `Bearer ${user1Token}` }
  });
  assert.strictEqual(check105.data.data.status, 'PARTIALLY_FINISHED');
  assert.strictEqual(check105.data.data.remainingQuantity, 50);

  // Inspect status of BUY 102 -> must remain PENDING with remainingQuantity = 100
  const check102 = await request(`/instructions/${buy102Id}`, {
    headers: { Authorization: `Bearer ${user1Token}` }
  });
  assert.strictEqual(check102.data.data.status, 'PENDING');
  assert.strictEqual(check102.data.data.remainingQuantity, 100);

  console.log('  PASSED: BUY @ 105 was given strict priority over BUY @ 102 (Price-First verified).\n');

  // Cancel remaining test orders
  await request(`/instructions/${buy105Id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });
  await request(`/instructions/${buy102Id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });

  // =========================================================================
  // TEST SUITE 2: R03 Time Priority Execution Testing (Equal Prices)
  // BUY A @ 100 (Timestamp T1) vs BUY B @ 100 (Timestamp T2 > T1).
  // SELL @ 100 (30 units).
  // The matching engine MUST match BUY A first!
  // =========================================================================
  console.log('[TEST 2] R03 - Time-First Priority Verification (Equal Prices)...');
  
  const timeA = new Date('2026-09-12T10:00:00.000Z').toISOString();
  const timeB = new Date('2026-09-12T10:01:00.000Z').toISOString();

  // Buy A: 50 @ 100 at 10:00:00
  const buyARes = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      type: 'BUY',
      quantity: 50,
      respectedPrice: 100.0,
      timestamp: timeA
    })
  });
  assert.strictEqual(buyARes.status, 201);
  const buyAId = buyARes.data.data.instruction.id;

  // Buy B: 50 @ 100 at 10:01:00 (1 minute later)
  const buyBRes = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      type: 'BUY',
      quantity: 50,
      respectedPrice: 100.0,
      timestamp: timeB
    })
  });
  assert.strictEqual(buyBRes.status, 201);
  const buyBId = buyBRes.data.data.instruction.id;

  // Sell: 30 @ 100
  const sellTimeRes = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      type: 'SELL',
      quantity: 30,
      respectedPrice: 100.0
    })
  });
  assert.strictEqual(sellTimeRes.status, 201);
  assert.strictEqual(sellTimeRes.data.data.executedTrades.length, 1);
  
  const timeTrade = sellTimeRes.data.data.executedTrades[0];
  console.log(`  -> Match executed: ${timeTrade.quantity} units @ $${timeTrade.price} with Buy: ${timeTrade.buyInstructionId}`);
  assert.strictEqual(timeTrade.buyInstructionId, buyAId, 'Time-First violation: Later order matched ahead of earlier order!');
  assert.strictEqual(timeTrade.quantity, 30);

  // Buy A should now be PARTIALLY_FINISHED with 20 remaining
  const checkA = await request(`/instructions/${buyAId}`, { headers: { Authorization: `Bearer ${user1Token}` } });
  assert.strictEqual(checkA.data.data.status, 'PARTIALLY_FINISHED');
  assert.strictEqual(checkA.data.data.remainingQuantity, 20);

  // Buy B should remain PENDING with 50 remaining
  const checkB = await request(`/instructions/${buyBId}`, { headers: { Authorization: `Bearer ${user1Token}` } });
  assert.strictEqual(checkB.data.data.status, 'PENDING');
  assert.strictEqual(checkB.data.data.remainingQuantity, 50);

  console.log('  PASSED: BUY A (10:00:00) matched before BUY B (10:01:00) (Time-First verified).\n');

  // Cancel remaining test orders
  await request(`/instructions/${buyAId}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });
  await request(`/instructions/${buyBId}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });

  // =========================================================================
  // TEST SUITE 2b: R03 Sell-Side Price Priority (Lowest Price First)
  // SELL X @ 105 vs SELL Y @ 101.
  // BUY @ 106 (30 units).
  // The matching engine MUST match SELL Y (@ 101) first!
  // =========================================================================
  console.log('[TEST 2b] R03 - Sell-Side Price-First Priority Verification (Lowest Price)...');

  const sellHighRes = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      type: 'SELL',
      quantity: 50,
      respectedPrice: 105.0
    })
  });
  assert.strictEqual(sellHighRes.status, 201);
  const sellHighId = sellHighRes.data.data.instruction.id;

  const sellLowRes = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user2Token}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      type: 'SELL',
      quantity: 50,
      respectedPrice: 101.0
    })
  });
  assert.strictEqual(sellLowRes.status, 201);
  const sellLowId = sellLowRes.data.data.instruction.id;

  const buyCrossRes = await request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: JSON.stringify({
      stockId: 'TEST_R03',
      type: 'BUY',
      quantity: 30,
      respectedPrice: 106.0
    })
  });
  assert.strictEqual(buyCrossRes.status, 201);
  assert.strictEqual(buyCrossRes.data.data.executedTrades.length, 1);

  const sellTrade = buyCrossRes.data.data.executedTrades[0];
  console.log(`  -> Match executed: ${sellTrade.quantity} units @ $${sellTrade.price} with Sell: ${sellTrade.sellInstructionId}`);
  assert.strictEqual(sellTrade.sellInstructionId, sellLowId, 'Price-First violation: Higher sell price matched instead of lowest!');
  assert.strictEqual(sellTrade.quantity, 30);

  const checkLow = await request(`/instructions/${sellLowId}`, { headers: { Authorization: `Bearer ${user2Token}` } });
  assert.strictEqual(checkLow.data.data.status, 'PARTIALLY_FINISHED');
  assert.strictEqual(checkLow.data.data.remainingQuantity, 20);

  const checkHigh = await request(`/instructions/${sellHighId}`, { headers: { Authorization: `Bearer ${user2Token}` } });
  assert.strictEqual(checkHigh.data.data.status, 'PENDING');
  assert.strictEqual(checkHigh.data.data.remainingQuantity, 50);

  console.log('  PASSED: SELL @ 101 was matched before SELL @ 105 (Lowest Price Priority verified).\n');

  // Cancel remaining test orders
  await request(`/instructions/${sellLowId}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user2Token}` } });
  await request(`/instructions/${sellHighId}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user2Token}` } });

  // =========================================================================
  // TEST SUITE 3: R06 Concurrency & Atomicity Verification
  // Available Balance: $10,000.00.
  // Order A: $7,000.00
  // Order B: $7,000.00
  // Submitted concurrently via Promise.all
  // Must NOT allow availableBalance = -$4,000.00 or freeze $14,000.00!
  // =========================================================================
  console.log('[TEST 3] R06 - Concurrency & Fund Freezing Race Condition Verification...');

  // Set user1 available balance to exactly $10,000.00
  const setBalRes = await request('/manager/set-balance', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      userId: user1Id,
      availableBalance: 10000.0,
      totalBalance: 10000.0
    })
  });
  assert.strictEqual(setBalRes.status, 200);

  const preCheck = await request('/accounts/me', { headers: { Authorization: `Bearer ${user1Token}` } });
  assert.strictEqual(preCheck.data.data.availableBalance, 10000.0);
  assert.strictEqual(preCheck.data.data.frozenBalance, 0);
  console.log(`  Initial User Balance: Available = $${preCheck.data.data.availableBalance}, Frozen = $${preCheck.data.data.frozenBalance}`);

  // Construct two concurrent BUY orders for MSFT (price = $200.0, qty = 35 -> $7,000.00 each)
  // Total attempted draw: $14,000.00 from a $10,000.00 account!
  console.log('  Firing 2 concurrent BUY orders of $7,000.00 each via Promise.all...');

  const orderA_Promise = request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: JSON.stringify({
      stockId: 'MSFT',
      type: 'BUY',
      quantity: 35,
      respectedPrice: 200.0 // 35 * 200 = $7,000.00
    })
  });

  const orderB_Promise = request('/instructions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: JSON.stringify({
      stockId: 'MSFT',
      type: 'BUY',
      quantity: 35,
      respectedPrice: 200.0 // 35 * 200 = $7,000.00
    })
  });

  const [resA, resB] = await Promise.all([orderA_Promise, orderB_Promise]);

  console.log(`  Order A response status: ${resA.status} (${resA.data.success ? 'ACCEPTED' : resA.data.errorCode})`);
  console.log(`  Order B response status: ${resB.status} (${resB.data.success ? 'ACCEPTED' : resB.data.errorCode})`);

  // Assert exact atomicity: ONE succeeds, ONE fails
  const statuses = [resA.status, resB.status].sort();
  assert.deepStrictEqual(statuses, [201, 400], 'Concurrency violation: Expected exactly 1 accepted and 1 rejected!');

  const rejectedRes = resA.status === 400 ? resA : resB;
  assert.strictEqual(rejectedRes.data.errorCode, 'INSUFFICIENT_FUNDS');

  // Verify final account balances
  const postCheck = await request('/accounts/me', { headers: { Authorization: `Bearer ${user1Token}` } });
  const finalAvail = postCheck.data.data.availableBalance;
  const finalFrozen = postCheck.data.data.frozenBalance;
  const finalTotal = postCheck.data.data.totalBalance;

  console.log(`  Post-Concurrency Balances: Available = $${finalAvail}, Frozen = $${finalFrozen}, Total = $${finalTotal}`);

  assert.strictEqual(finalAvail, 3000.0, `Race condition detected: Available balance is $${finalAvail}, expected exactly $3,000.00!`);
  assert.strictEqual(finalFrozen, 7000.0, `Race condition detected: Frozen balance is $${finalFrozen}, expected exactly $7,000.00!`);
  assert.strictEqual(finalTotal, 10000.0, `Accounting mismatch: Total balance is $${finalTotal}, expected $10,000.00!`);

  console.log('  PASSED: Concurrency race condition prevented! Account balance never went negative (-$4,000).\n');

  // Cancel accepted order to restore balance
  const acceptedOrder = resA.status === 201 ? resA.data.data.instruction : resB.data.data.instruction;
  await request(`/instructions/${acceptedOrder.id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${user1Token}` } });

  console.log('===========================================================');
  console.log(' ALL DEEP R03 & R06 CONCURRENCY TESTS PASSED FLAWLESSLY!   ');
  console.log('===========================================================');
}

runDeepVerification().catch(err => {
  console.error('Deep Verification FAILED:', err);
  process.exit(1);
});
