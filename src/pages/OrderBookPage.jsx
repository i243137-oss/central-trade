import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Layers,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Clock,
  Info
} from 'lucide-react';

export default function OrderBookPage() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [orderBook, setOrderBook] = useState({ buys: [], sells: [] });
  const [loading, setLoading] = useState(true);
  const [matchingFeedback, setMatchingFeedback] = useState(null);
  const [executing, setExecuting] = useState(false);

  const fetchStocks = async () => {
    try {
      const res = await api.getStocks();
      if (res.success && res.data && res.data.length > 0) {
        setStocks(res.data);
        if (!selectedStock) {
          setSelectedStock(res.data[0].symbol);
        }
      }
    } catch (err) {
      console.error('[OrderBookPage] Error loading stocks:', err);
    }
  };

  const fetchOrderBook = async (symbol) => {
    setLoading(true);
    try {
      const res = await api.getOrderBook(symbol);
      if (res.success && res.data) {
        setOrderBook({
          buys: res.data.buys || [],
          sells: res.data.sells || []
        });
      }
    } catch (err) {
      console.error('[OrderBookPage] Error fetching order book:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, []);

  useEffect(() => {
    if (selectedStock) {
      fetchOrderBook(selectedStock);
    }
  }, [selectedStock]);

  const handleRunMatching = async () => {
    setExecuting(true);
    setMatchingFeedback(null);
    try {
      const res = await api.runMatching(selectedStock);
      if (res.success) {
        const trades = res.data.trades || [];
        setMatchingFeedback({
          count: trades.length,
          trades,
          message: res.message
        });
        fetchOrderBook(selectedStock);
      }
    } catch (err) {
      setMatchingFeedback({
        error: err.message || 'Error executing matching engine.'
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            Order Book & Price-Time Priority (SRS R03)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Active instructions ordered by Price First principle, then Time First principle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Stock Selector */}
          <select
            value={selectedStock}
            onChange={(e) => setSelectedStock(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
          >
            {stocks.map((s) => (
              <option key={s.stockId} value={s.symbol}>
                {s.symbol} ({s.name})
              </option>
            ))}
          </select>

          {/* Trigger Matching Engine */}
          <button
            onClick={handleRunMatching}
            disabled={executing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-950 transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {executing ? 'Matching...' : 'Run Matching (R03)'}
          </button>

          <button
            onClick={() => fetchOrderBook(selectedStock)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh order book"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Matching Run Feedback */}
      {matchingFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs ${
            matchingFeedback.error
              ? 'bg-rose-950/80 border-rose-800 text-rose-200'
              : 'bg-purple-950/80 border-purple-800 text-purple-200'
          }`}
        >
          {matchingFeedback.error ? (
            <div>Error: {matchingFeedback.error}</div>
          ) : (
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {matchingFeedback.message}
              </div>
              {matchingFeedback.trades && matchingFeedback.trades.length > 0 && (
                <div className="mt-2 space-y-1 font-mono">
                  {matchingFeedback.trades.map((t, idx) => (
                    <div key={idx} className="bg-purple-900/40 p-2 rounded border border-purple-800/60">
                      Trade ID: {t.id} | Executed: {t.quantity} shares of {t.stockId} @ ${Number(t.price).toFixed(2)} (Buy: {t.buyInstructionId}, Sell: {t.sellInstructionId})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SRS Matching Rule Note */}
      <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">SRS 7.2.1 Matching Principles:</span>
          <p className="mt-0.5 text-[11px]">
            1. <strong>Price First Principle:</strong> BUY instructions with higher prices sort first; SELL instructions with lower prices sort first.
            <br />
            2. <strong>Time First Principle:</strong> Equal price instructions are matched strictly by earlier submission timestamp.
            <br />
            3. <strong>Execution Rule:</strong> Match occurs when lowest buy price &gt;= highest sell price (or buy price &gt;= sell price).
          </p>
        </div>
      </div>

      {/* Two Column Order Book: Bids (BUY) vs Asks (SELL) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bids (BUY Instructions) */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 bg-emerald-950/40 border-b border-emerald-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-emerald-300 text-sm">
                BIDS (BUY Instructions)
              </h2>
            </div>
            <span className="text-xs text-emerald-400 font-mono">
              {orderBook.buys.length} Active Orders
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Queue</th>
                  <th className="px-3 py-2.5">Order ID</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-right">Remaining Qty</th>
                  <th className="px-3 py-2.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {orderBook.buys.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-3 py-8 text-center text-slate-500 font-sans">
                      No active BUY instructions for {selectedStock}.
                    </td>
                  </tr>
                ) : (
                  orderBook.buys.map((buy, idx) => (
                    <tr key={buy.id} className="hover:bg-emerald-950/20 transition-colors">
                      <td className="px-3 py-2 font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {buy.id}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-400">
                        ${Number(buy.respectedPrice).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-200">
                        {buy.remainingQuantity}
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-[11px] font-sans">
                        {new Date(buy.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Asks (SELL Instructions) */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 bg-rose-950/40 border-b border-rose-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              <h2 className="font-bold text-rose-300 text-sm">
                ASKS (SELL Instructions)
              </h2>
            </div>
            <span className="text-xs text-rose-400 font-mono">
              {orderBook.sells.length} Active Orders
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Queue</th>
                  <th className="px-3 py-2.5">Order ID</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-right">Remaining Qty</th>
                  <th className="px-3 py-2.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {orderBook.sells.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-3 py-8 text-center text-slate-500 font-sans">
                      No active SELL instructions for {selectedStock}.
                    </td>
                  </tr>
                ) : (
                  orderBook.sells.map((sell, idx) => (
                    <tr key={sell.id} className="hover:bg-rose-950/20 transition-colors">
                      <td className="px-3 py-2 font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {sell.id}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-rose-400">
                        ${Number(sell.respectedPrice).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-200">
                        {sell.remainingQuantity}
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-[11px] font-sans">
                        {new Date(sell.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
