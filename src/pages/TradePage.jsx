import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Lock,
  Wallet,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function TradePage() {
  const { user, account, refreshAccount } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(searchParams.get('stock') || 'AAPL');
  const [type, setType] = useState('BUY');
  const [quantity, setQuantity] = useState('10');
  const [respectedPrice, setRespectedPrice] = useState('100.00');
  const [customTimestamp, setCustomTimestamp] = useState('');
  const [useCustomTime, setUseCustomTime] = useState(false);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message, details }

  useEffect(() => {
    async function loadStocks() {
      try {
        const res = await api.getStocks();
        if (res.success && res.data) {
          setStocks(res.data);
          const initial = searchParams.get('stock') || (res.data[0] ? res.data[0].symbol : 'AAPL');
          setSelectedStock(initial);
        }
      } catch (err) {
        console.error('[TradePage] Error fetching stocks:', err);
      }
    }
    loadStocks();
  }, [searchParams]);

  const activeStockInfo = stocks.find(s => s.symbol === selectedStock) || null;
  const numQty = Number(quantity) || 0;
  const numPrice = Number(respectedPrice) || 0;
  const totalCost = numQty * numPrice;
  const availableBal = Number(account?.availableBalance || 0);
  const isInsufficient = type === 'BUY' && totalCost > availableBal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);

    const payload = {
      stockId: selectedStock,
      type,
      quantity: numQty,
      respectedPrice: numPrice
    };

    if (useCustomTime && customTimestamp) {
      payload.timestamp = new Date(customTimestamp).toISOString();
    }

    try {
      const res = await api.createInstruction(payload);
      if (res.success) {
        const executedCount = res.data.executedTrades?.length || 0;
        let successMsg = `Instruction saved successfully! Status: ${res.data.instruction.status}`;
        if (executedCount > 0) {
          successMsg += ` (Matched and executed ${executedCount} trade(s)!)`;
        }

        setFeedback({
          type: 'success',
          message: successMsg,
          details: res.data
        });
        refreshAccount();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Trading instruction rejected.',
        errorCode: err.errorCode
      });
    } finally {
      setLoading(false);
    }
  };

  // Quick Boundary & Academic Test Helpers
  const applyPresetPrice = (priceVal) => {
    setRespectedPrice(Number(priceVal).toFixed(2));
  };

  const setOldTimestamp = () => {
    setUseCustomTime(true);
    // Set 30 hours ago for R05 testing
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
    setCustomTimestamp(thirtyHoursAgo.toISOString().slice(0, 16));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Submit Trading Instruction (SRS 7.1.1)
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Parameters: User ID ({user?.id}), Stock ID, Quantity, Respected Price, Timestamp
        </p>
      </div>

      {/* Immediate Result Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-sm">
            <div className="font-semibold">{feedback.message}</div>
            {feedback.errorCode && (
              <div className="text-xs text-rose-300/80 mt-1">
                Error Code: <span className="font-mono bg-rose-900/60 px-1 py-0.5 rounded">{feedback.errorCode}</span>
              </div>
            )}
            {feedback.details && feedback.details.instruction && (
              <div className="mt-2 text-xs text-emerald-300/90 bg-emerald-900/30 p-2.5 rounded-lg border border-emerald-800/60 font-mono space-y-1">
                <div>Instruction ID: {feedback.details.instruction.id}</div>
                <div>Status: {feedback.details.instruction.status} | Remaining: {feedback.details.instruction.remainingQuantity} / {feedback.details.instruction.quantity}</div>
                {feedback.details.instruction.frozenAmount > 0 && (
                  <div>Frozen Funds: ${feedback.details.instruction.frozenAmount.toFixed(2)}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Instruction Form */}
        <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Stock Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Stock ID (Symbol)
              </label>
              <select
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {stocks.map(s => (
                  <option key={s.stockId} value={s.symbol}>
                    {s.symbol} — {s.name} (Limits: ${s.fallingLimit.toFixed(2)} - ${s.risingLimit.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Instruction Type: BUY vs SELL */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Instruction Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('BUY')}
                  className={`py-2.5 px-4 rounded-lg font-bold text-sm transition border ${
                    type === 'BUY'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  BUY Instruction
                </button>
                <button
                  type="button"
                  onClick={() => setType('SELL')}
                  className={`py-2.5 px-4 rounded-lg font-bold text-sm transition border ${
                    type === 'SELL'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  SELL Instruction
                </button>
              </div>
            </div>

            {/* Quantity and Respected Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quantity (Units)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Respected / Requested Price ($)
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={respectedPrice}
                  onChange={(e) => setRespectedPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Price-Limits Status Reminder */}
            {activeStockInfo && (
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-400">R04 Limits for {activeStockInfo.symbol}:</span>
                <div className="flex gap-3">
                  <span className="text-rose-400 font-mono">Falling: ${activeStockInfo.fallingLimit.toFixed(2)}</span>
                  <span className="text-emerald-400 font-mono">Rising: ${activeStockInfo.risingLimit.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Cost & Freezing Summary */}
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Calculated Required Value:</span>
                <span className="font-mono font-bold text-white">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {type === 'BUY' && (
                <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Amount to Freeze (R06):
                  </span>
                  <span className={`font-mono font-bold ${isInsufficient ? 'text-rose-400' : 'text-amber-400'}`}>
                    ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {isInsufficient && (
                <div className="text-rose-400 text-[11px] pt-1 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Warning: Insufficient available funds (${availableBal.toFixed(2)}). Pretreatment will reject!
                </div>
              )}
            </div>

            {/* Academic R05 Testing: Custom Timestamp Option */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomTime}
                    onChange={(e) => setUseCustomTime(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Override Timestamp (Academic R05 Outdated Testing)</span>
                </label>
                {useCustomTime && (
                  <button
                    type="button"
                    onClick={setOldTimestamp}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Quick: Set 30 Hours Ago
                  </button>
                )}
              </div>

              {useCustomTime && (
                <div className="mt-2">
                  <input
                    type="datetime-local"
                    value={customTimestamp}
                    onChange={(e) => setCustomTimestamp(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Allows testing outdated instruction rule (&gt;24 hours) without waiting 1 day or manipulating the server clock.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-bold text-white text-sm shadow-lg transition flex items-center justify-center gap-2 ${
                type === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950'
              } disabled:opacity-50`}
            >
              <TrendingUp className="w-4 h-4" />
              {loading ? 'Submitting to Pretreatment...' : `Submit ${type} Instruction`}
            </button>
          </form>
        </div>

        {/* Academic Evaluator Testing Panel */}
        <div className="space-y-4">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              SE3002 Evaluation Presets
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Quickly test R04 Rising/Falling boundary conditions for {activeStockInfo?.symbol}:
            </p>

            {activeStockInfo && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => applyPresetPrice(activeStockInfo.fallingLimit)}
                  className="w-full p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-xs transition"
                >
                  <div className="font-semibold text-emerald-300">Boundary: Exact Falling Limit</div>
                  <div className="text-[11px] text-slate-400 font-mono">${activeStockInfo.fallingLimit.toFixed(2)} (Accept)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetPrice(activeStockInfo.risingLimit)}
                  className="w-full p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-xs transition"
                >
                  <div className="font-semibold text-emerald-300">Boundary: Exact Rising Limit</div>
                  <div className="text-[11px] text-slate-400 font-mono">${activeStockInfo.risingLimit.toFixed(2)} (Accept)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetPrice(activeStockInfo.fallingLimit - 5.0)}
                  className="w-full p-2 bg-slate-950 hover:bg-rose-950/40 border border-rose-900/50 rounded-lg text-left text-xs transition"
                >
                  <div className="font-semibold text-rose-400">Invalid: Below Falling Limit</div>
                  <div className="text-[11px] text-slate-400 font-mono">${(activeStockInfo.fallingLimit - 5.0).toFixed(2)} (Reject R04)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetPrice(activeStockInfo.risingLimit + 5.0)}
                  className="w-full p-2 bg-slate-950 hover:bg-rose-950/40 border border-rose-900/50 rounded-lg text-left text-xs transition"
                >
                  <div className="font-semibold text-rose-400">Invalid: Above Rising Limit</div>
                  <div className="text-[11px] text-slate-400 font-mono">${(activeStockInfo.risingLimit + 5.0).toFixed(2)} (Reject R04)</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setType('BUY');
                    setQuantity('2000');
                    setRespectedPrice(activeStockInfo.risingLimit.toString());
                  }}
                  className="w-full p-2 bg-slate-950 hover:bg-amber-950/40 border border-amber-900/50 rounded-lg text-left text-xs transition"
                >
                  <div className="font-semibold text-amber-400">Test: Insufficient Funds</div>
                  <div className="text-[11px] text-slate-400">Large BUY exceeding available balance (Reject R06)</div>
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="font-semibold text-slate-200">CTS Pipeline (SRS Architecture):</div>
            <div className="space-y-1 text-[11px]">
              <div>1. Pretreatment analyzes price & limits (R04)</div>
              <div>2. Freezes buyer funds in Security Account (R06)</div>
              <div>3. Saves instruction in CTS Instruction List</div>
              <div>4. Invokes Dealing Manager for immediate matching</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
