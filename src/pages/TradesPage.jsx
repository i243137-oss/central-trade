import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Clock, RefreshCw, Filter, Layers } from 'lucide-react';

export default function TradesPage() {
  const [trades, setTrades] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const stockParam = selectedStock === 'ALL' ? '' : selectedStock;
      const res = await api.getTrades(stockParam);
      if (res.success) {
        setTrades(res.data || []);
      }
    } catch (err) {
      console.error('[TradesPage] Error fetching trades:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadStocks() {
      try {
        const res = await api.getStocks();
        if (res.success) setStocks(res.data || []);
      } catch (err) {
        console.error('[TradesPage] Error loading stocks:', err);
      }
    }
    loadStocks();
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [selectedStock]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            CTS Executed Trades History
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Successful matching results produced by Central Trading System (SRS 7.2.1)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedStock}
            onChange={(e) => setSelectedStock(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Stocks</option>
            {stocks.map((s) => (
              <option key={s.stockId} value={s.symbol}>
                {s.symbol}
              </option>
            ))}
          </select>

          <button
            onClick={fetchTrades}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh trades"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Trades Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Trade ID</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Execution Price</th>
                <th className="px-4 py-3 text-right">Total Value</th>
                <th className="px-4 py-3">Buyer Order</th>
                <th className="px-4 py-3">Seller Order</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    Loading trades...
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    No trades executed yet for this selection.
                  </td>
                </tr>
              ) : (
                trades.map((t) => {
                  const total = t.quantity * t.price;
                  return (
                    <tr key={t.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-emerald-400">
                        {t.id}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {t.stockId}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {t.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-300">
                        ${Number(t.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-white">
                        ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {t.buyInstructionId} ({t.buyerUserId})
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {t.sellInstructionId} ({t.sellerUserId})
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px] font-sans">
                        {new Date(t.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
