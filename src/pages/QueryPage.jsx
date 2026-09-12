import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Search,
  RotateCcw,
  Code,
  Table,
  CheckCircle2,
  AlertCircle,
  User,
  TrendingUp,
  FileText
} from 'lucide-react';

export default function QueryPage() {
  const { user, isManager } = useAuth();

  // Mode: 'USER_QUERY' | 'STOCK_QUERY'
  const [activeTab, setActiveTab] = useState('USER_QUERY');

  // User Query Form State (SRS 7.1.1 c)
  const [userIdParam, setUserIdParam] = useState(user?.id || '');
  const [userQueryContent, setUserQueryContent] = useState('ALL'); // ALL, INSTRUCTIONS, TRADES, ACCOUNT
  const [userRestrictStock, setUserRestrictStock] = useState('');
  const [userRestrictStatus, setUserRestrictStatus] = useState('');

  // Stock Query Form State (SRS 7.1.1 c)
  const [stockIdParam, setStockIdParam] = useState('AAPL');
  const [stockQueryContent, setStockQueryContent] = useState('ALL'); // ALL, PRICE, TRADES, ORDERS
  const [stockRestrictLimit, setStockRestrictLimit] = useState('');

  // View Mode: 'TABLE' or 'JSON'
  const [viewMode, setViewMode] = useState('TABLE');

  const [loading, setLoading] = useState(false);
  const [queryResponse, setQueryResponse] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleUserQuery = async (e) => {
    e?.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const restrictParameters = {};
    if (userRestrictStock) restrictParameters.stockId = userRestrictStock;
    if (userRestrictStatus) restrictParameters.status = userRestrictStatus;

    try {
      const res = await api.userQuery({
        userId: userIdParam || user?.id,
        queryContent: userQueryContent,
        restrictParameters: JSON.stringify(restrictParameters)
      });
      setQueryResponse(res);
    } catch (err) {
      setErrorMessage(err.message || 'Invalid query parameters or query failed.');
      setQueryResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStockQuery = async (e) => {
    e?.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const restrictParameters = {};
    if (stockRestrictLimit) restrictParameters.limit = Number(stockRestrictLimit);

    try {
      const res = await api.stockQuery({
        stockId: stockIdParam,
        queryContent: stockQueryContent,
        restrictParameters: JSON.stringify(restrictParameters)
      });
      setQueryResponse(res);
    } catch (err) {
      setErrorMessage(err.message || 'Invalid query parameters or query failed.');
      setQueryResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUserIdParam(user?.id || '');
    setUserQueryContent('ALL');
    setUserRestrictStock('');
    setUserRestrictStatus('');
    setStockIdParam('AAPL');
    setStockQueryContent('ALL');
    setStockRestrictLimit('');
    setQueryResponse(null);
    setErrorMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-400" />
            CTS Query Trade Information (SRS 7.1.1 c & R07)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Structuralize queried CTS data for Trading Information Release module and users.
          </p>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('TABLE')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              viewMode === 'TABLE'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Structured View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('JSON')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              viewMode === 'JSON'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            JSON Payload
          </button>
        </div>
      </div>

      {/* SRS Query Tab Switcher */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => {
            setActiveTab('USER_QUERY');
            setQueryResponse(null);
            setErrorMessage('');
          }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'USER_QUERY'
              ? 'border-amber-400 text-amber-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          User Query Instruction (SRS 7.1.1.c)
        </button>
        <button
          onClick={() => {
            setActiveTab('STOCK_QUERY');
            setQueryResponse(null);
            setErrorMessage('');
          }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'STOCK_QUERY'
              ? 'border-amber-400 text-amber-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Stock Query Instruction (SRS 7.1.1.c & 7.1.2)
        </button>
      </div>

      {/* Query Form */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        {activeTab === 'USER_QUERY' ? (
          <form onSubmit={handleUserQuery} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Parameter 1: User ID
                </label>
                <input
                  type="text"
                  value={userIdParam}
                  onChange={(e) => setUserIdParam(e.target.value)}
                  disabled={!isManager}
                  placeholder={user?.id}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-amber-500 disabled:opacity-60"
                />
                {!isManager && (
                  <span className="text-[10px] text-slate-400">Locked to your user ID (SRS Authorization)</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Parameter 2: Query Content
                </label>
                <select
                  value={userQueryContent}
                  onChange={(e) => setUserQueryContent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">ALL (Full Portfolio & History)</option>
                  <option value="INSTRUCTIONS">INSTRUCTIONS (Submitted Orders)</option>
                  <option value="TRADES">TRADES (Executed Deals)</option>
                  <option value="ACCOUNT">ACCOUNT (Security Balance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Restrict: Stock Symbol
                </label>
                <input
                  type="text"
                  value={userRestrictStock}
                  onChange={(e) => setUserRestrictStock(e.target.value.toUpperCase())}
                  placeholder="e.g. AAPL (optional)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Restrict: Status
                </label>
                <select
                  value={userRestrictStatus}
                  onChange={(e) => setUserRestrictStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">Any Status</option>
                  <option value="PENDING">PENDING</option>
                  <option value="PARTIALLY_FINISHED">PARTIALLY_FINISHED</option>
                  <option value="TOTALLY_FINISHED">TOTALLY_FINISHED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="EXPIRED">EXPIRED</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow transition disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                {loading ? 'Executing Query...' : 'Execute User Query'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStockQuery} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Parameter 1: Stock ID (Symbol)
                </label>
                <input
                  type="text"
                  required
                  value={stockIdParam}
                  onChange={(e) => setStockIdParam(e.target.value.toUpperCase())}
                  placeholder="e.g. AAPL, MSFT, GOOG"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Parameter 2: Query Content
                </label>
                <select
                  value={stockQueryContent}
                  onChange={(e) => setStockQueryContent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">ALL (Price, Limits, Trades, Active Orders)</option>
                  <option value="PRICE">PRICE & LIMITS (Information Releasing)</option>
                  <option value="TRADES">TRADES (Execution History)</option>
                  <option value="ORDERS">ORDERS (Active Depth)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Restrict: Limit Records
                </label>
                <input
                  type="number"
                  min="1"
                  value={stockRestrictLimit}
                  onChange={(e) => setStockRestrictLimit(e.target.value)}
                  placeholder="e.g. 10 (optional)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow transition disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                {loading ? 'Executing Query...' : 'Execute Stock Query'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Query Result Section */}
      {queryResponse && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-200">
              {queryResponse.message || 'Structuralized Query Result'}
            </span>
            <span>Query Timestamp: {new Date(queryResponse.data?.timestamp || Date.now()).toLocaleTimeString()}</span>
          </div>

          {viewMode === 'JSON' ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[500px]">
              <pre>{JSON.stringify(queryResponse.data, null, 2)}</pre>
            </div>
          ) : (
            <div className="space-y-4">
              {/* If Account in data */}
              {queryResponse.data?.data?.account && (
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Security Account Details (User {queryResponse.data.userId})
                  </h3>
                  <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Total Balance</span>
                      <span className="font-bold text-white text-base">
                        ${Number(queryResponse.data.data.account.totalBalance).toFixed(2)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Available Balance</span>
                      <span className="font-bold text-emerald-400 text-base">
                        ${Number(queryResponse.data.data.account.availableBalance).toFixed(2)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Frozen Balance</span>
                      <span className="font-bold text-amber-400 text-base">
                        ${Number(queryResponse.data.data.account.frozenBalance).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* If Pricing / Limits in data */}
              {queryResponse.data?.data?.pricing && (
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Stock Pricing & Limits (Information Releasing Module SRS 7.1.2)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Symbol</span>
                      <span className="font-bold text-white text-base">{queryResponse.data.data.pricing.symbol}</span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Latest Price</span>
                      <span className="font-bold text-emerald-400 text-base">${Number(queryResponse.data.data.pricing.latestPrice).toFixed(2)}</span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-rose-400 block text-[10px]">Falling Limit (R04)</span>
                      <span className="font-bold text-slate-200 text-base">${Number(queryResponse.data.data.pricing.fallingLimit).toFixed(2)}</span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-emerald-400 block text-[10px]">Rising Limit (R04)</span>
                      <span className="font-bold text-slate-200 text-base">${Number(queryResponse.data.data.pricing.risingLimit).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* If Instructions in data */}
              {queryResponse.data?.data?.instructions && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-4 bg-slate-950 border-b border-slate-800 text-xs font-bold text-slate-200">
                    Queried Instructions ({queryResponse.data.data.instructions.length} items)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300 font-mono">
                      <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-2">ID</th>
                          <th className="px-4 py-2">Stock</th>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2 text-right">Remaining / Total</th>
                          <th className="px-4 py-2 text-right">Price</th>
                          <th className="px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {queryResponse.data.data.instructions.length === 0 ? (
                          <tr><td colSpan="6" className="px-4 py-6 text-center text-slate-500 font-sans">No instructions match this query.</td></tr>
                        ) : (
                          queryResponse.data.data.instructions.map(ord => (
                            <tr key={ord.id}>
                              <td className="px-4 py-2 font-semibold text-slate-200">{ord.id}</td>
                              <td className="px-4 py-2 font-bold text-white">{ord.stockId}</td>
                              <td className="px-4 py-2">{ord.type}</td>
                              <td className="px-4 py-2 text-right">{ord.remainingQuantity} / {ord.quantity}</td>
                              <td className="px-4 py-2 text-right">${Number(ord.respectedPrice).toFixed(2)}</td>
                              <td className="px-4 py-2 font-sans">{ord.status}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* If Trades in data */}
              {queryResponse.data?.data?.trades && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-4 bg-slate-950 border-b border-slate-800 text-xs font-bold text-slate-200">
                    Queried Trades ({queryResponse.data.data.trades.length} items)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300 font-mono">
                      <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-2">Trade ID</th>
                          <th className="px-4 py-2">Stock</th>
                          <th className="px-4 py-2 text-right">Quantity</th>
                          <th className="px-4 py-2 text-right">Price</th>
                          <th className="px-4 py-2">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {queryResponse.data.data.trades.length === 0 ? (
                          <tr><td colSpan="5" className="px-4 py-6 text-center text-slate-500 font-sans">No trades found.</td></tr>
                        ) : (
                          queryResponse.data.data.trades.map(t => (
                            <tr key={t.id}>
                              <td className="px-4 py-2 font-semibold text-emerald-400">{t.id}</td>
                              <td className="px-4 py-2 font-bold text-white">{t.stockId}</td>
                              <td className="px-4 py-2 text-right">{t.quantity}</td>
                              <td className="px-4 py-2 text-right font-bold text-slate-100">${Number(t.price).toFixed(2)}</td>
                              <td className="px-4 py-2 text-slate-400 text-[11px] font-sans">{new Date(t.timestamp).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
