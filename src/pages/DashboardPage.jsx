import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Wallet,
  Lock,
  DollarSign,
  TrendingUp,
  Layers,
  FileText,
  Clock,
  Search,
  ShieldCheck,
  AlertTriangle,
  PlusCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function DashboardPage() {
  const { user, account, isManager, refreshAccount } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [myTrades, setMyTrades] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMsg, setDepositMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [stocksRes, ordersRes, tradesRes, healthRes] = await Promise.all([
          api.getStocks(),
          api.getInstructions({ userId: user?.id }),
          api.getTrades(),
          fetch('/api/health').then(r => r.json()).catch(() => null)
        ]);

        if (stocksRes.success) setStocks(stocksRes.data || []);
        if (ordersRes.success) setMyOrders(ordersRes.data || []);
        if (tradesRes.success) {
          const allTrades = tradesRes.data || [];
          setMyTrades(allTrades.filter(t => t.buyerUserId === user?.id || t.sellerUserId === user?.id));
        }
        if (healthRes) setSystemHealth(healthRes);
      } catch (err) {
        console.error('[Dashboard] Error loading data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user]);

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!depositAmount || Number(depositAmount) <= 0) return;
    try {
      const res = await api.depositFunds(Number(depositAmount));
      if (res.success) {
        setDepositMsg(`Successfully added $${Number(depositAmount).toFixed(2)} to account!`);
        setDepositAmount('');
        refreshAccount();
        setTimeout(() => setDepositMsg(''), 4000);
      }
    } catch (err) {
      setDepositMsg(`Deposit error: ${err.message}`);
    }
  };

  const pendingOrdersCount = myOrders.filter(o => o.status === 'PENDING' || o.status === 'PARTIALLY_FINISHED').length;

  return (
    <div className="space-y-6">
      {/* Welcome & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome back, {user?.name}
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                isManager
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              }`}
            >
              {user?.role}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Central Trading System (CTS) — Academic Simulation Terminal
          </p>
        </div>

        {/* Operational Status Badge */}
        <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-800">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse bg-emerald-500" />
          <div className="text-xs">
            <span className="text-slate-400 block text-[10px]">CTS Status:</span>
            <span className="font-semibold text-slate-200">
              {systemHealth?.operationsSuspended ? (
                <span className="text-amber-400 font-bold">OPERATIONS SUSPENDED</span>
              ) : (
                <span className="text-emerald-400">NORMAL OPERATIONS</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* R06 Security Account Balances (Fund Freezing display) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Balance */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium">Total Balance</span>
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white">
            ${Number(account?.totalBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Sum of Available + Frozen balance
          </p>
        </div>

        {/* Available Balance */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium">Available Balance (R06)</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400">
            ${Number(account?.availableBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Funds eligible for new BUY instructions
          </p>
        </div>

        {/* Frozen Balance */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium">Frozen Balance (R06)</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-400">
            ${Number(account?.frozenBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Held in escrow for active pending BUY orders
          </p>
        </div>
      </div>

      {/* Funds Deposit for Academic Testing */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="font-semibold text-slate-200 block">Simulate Account Deposit</span>
          <span className="text-slate-400">Replenish test funds to execute large buy instructions</span>
        </div>
        <form onSubmit={handleDeposit} className="flex items-center gap-2">
          <input
            type="number"
            placeholder="e.g. 10000"
            min="1"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="w-32 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Deposit
          </button>
        </form>
      </div>

      {depositMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {depositMsg}
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/trade"
          className="p-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-700/50 transition group"
        >
          <TrendingUp className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-semibold text-slate-200">Submit Instruction</div>
          <div className="text-[11px] text-slate-400 mt-0.5">R01 Buy/Sell & R04 Limits</div>
        </Link>

        <Link
          to="/orders"
          className="p-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-blue-700/50 transition group"
        >
          <FileText className="w-5 h-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-semibold text-slate-200">My Instructions</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{pendingOrdersCount} active orders (R02 Cancel)</div>
        </Link>

        <Link
          to="/order-book"
          className="p-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-purple-700/50 transition group"
        >
          <Layers className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-semibold text-slate-200">Order Book</div>
          <div className="text-[11px] text-slate-400 mt-0.5">R03 Price-Time Priority</div>
        </Link>

        <Link
          to="/query"
          className="p-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-700/50 transition group"
        >
          <Search className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-semibold text-slate-200">SRS Query Module</div>
          <div className="text-[11px] text-slate-400 mt-0.5">R07 User & Stock Queries</div>
        </Link>
      </div>

      {/* Two Columns: Stocks with Limits (R04) and Recent Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stocks & Price Limits (R04) */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              CTS Registered Stocks & Limits (R04)
            </h2>
            <span className="text-xs text-slate-400">Rising & Falling Constraints</span>
          </div>

          <div className="space-y-2.5">
            {stocks.map((stock) => (
              <div
                key={stock.stockId}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-100 text-sm">{stock.symbol}</span>
                  <span className="text-slate-400 text-xs ml-2">{stock.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="text-right">
                    <span className="text-[10px] text-rose-400 block">Falling Limit:</span>
                    <span className="font-semibold text-slate-300">${Number(stock.fallingLimit).toFixed(2)}</span>
                  </div>
                  <div className="text-right border-l border-slate-800 pl-3">
                    <span className="text-[10px] text-emerald-400 block">Rising Limit:</span>
                    <span className="font-semibold text-slate-300">${Number(stock.risingLimit).toFixed(2)}</span>
                  </div>
                  <Link
                    to={`/trade?stock=${stock.symbol}`}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium ml-1 transition"
                  >
                    Trade
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Instructions */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              My Recent Instructions
            </h2>
            <Link to="/orders" className="text-xs text-emerald-400 hover:underline">
              View all ({myOrders.length})
            </Link>
          </div>

          {myOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No instructions submitted yet. Go to Trade to submit your first BUY or SELL order.
            </div>
          ) : (
            <div className="space-y-2">
              {myOrders.slice(0, 5).map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                        ord.type === 'BUY'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {ord.type}
                    </span>
                    <span className="font-semibold text-slate-200">{ord.stockId}</span>
                    <span className="text-slate-400">
                      {ord.remainingQuantity} / {ord.quantity} @ ${Number(ord.respectedPrice).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        ord.status === 'TOTALLY_FINISHED'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : ord.status === 'PARTIALLY_FINISHED'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : ord.status === 'PENDING'
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : ord.status === 'CANCELLED'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-purple-950 text-purple-300 border border-purple-800'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
