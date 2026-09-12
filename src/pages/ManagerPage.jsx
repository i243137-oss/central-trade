import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  ShieldCheck,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Clock,
  RotateCcw,
  Sliders,
  CheckCircle2,
  FileText,
  Users,
  ScrollText,
  Lock
} from 'lucide-react';

export default function ManagerPage() {
  const { user, isManager } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Stock edit state
  const [editingStock, setEditingStock] = useState(null);
  const [editFalling, setEditFalling] = useState('');
  const [editRising, setEditRising] = useState('');

  // Outdated sweep hours
  const [sweepHours, setSweepHours] = useState('24');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getManagerOverview();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Access Denied: You do not have manager authorization.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isManager) {
      loadData();
    }
  }, [isManager]);

  // Authorization Boundary Check (R10)
  if (!isManager) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900 border border-rose-900/60 rounded-2xl text-center space-y-4">
        <div className="w-14 h-14 bg-rose-950 rounded-2xl mx-auto flex items-center justify-center text-rose-400 border border-rose-800">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          403 Forbidden: Authorized Access Only (R10)
        </h2>
        <p className="text-xs sm:text-sm text-slate-300">
          SRS 1.2 & R10 states that only the <strong>SYSTEM_MANAGER</strong> is authorized to access and modify CTS management information.
        </p>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-400">
          Current User Role: <span className="text-emerald-400 font-bold">{user?.role || 'UNAUTHENTICATED'}</span> | User ID: {user?.id}
        </div>
        <p className="text-xs text-slate-500">
          Log in with <code className="text-amber-300 font-bold">manager@example.com</code> to exercise management privileges.
        </p>
      </div>
    );
  }

  const handleToggleSuspend = async () => {
    const currentState = data?.stats?.operationsSuspended;
    try {
      const res = await api.toggleSuspension(!currentState);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message
        });
        loadData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to toggle suspension'
      });
    }
  };

  const handleSweepOutdated = async () => {
    try {
      const res = await api.triggerOutdatedSweep(Number(sweepHours));
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message
        });
        loadData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to trigger sweep'
      });
    }
  };

  const handleStartEditStock = (stock) => {
    setEditingStock(stock.symbol);
    setEditFalling(stock.fallingLimit.toString());
    setEditRising(stock.risingLimit.toString());
  };

  const handleSaveStockLimits = async (stockSymbol) => {
    try {
      const res = await api.updateStockLimits(stockSymbol, {
        fallingLimit: Number(editFalling),
        risingLimit: Number(editRising)
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message
        });
        setEditingStock(null);
        loadData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error updating stock limits.'
      });
    }
  };

  const handleResetDb = async () => {
    if (!window.confirm('Reset database to initial academic seed state?')) return;
    try {
      const res = await api.resetDatabase();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Database reset and re-seeded successfully.'
        });
        loadData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error resetting database'
      });
    }
  };

  const isSuspended = data?.stats?.operationsSuspended;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            Trading Management System Terminal (SRS R10)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Authorized administrator operations: system suspension, limit configuration, outdated sweep, audit logs.
          </p>
        </div>

        <button
          onClick={handleResetDb}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Seed Data
        </button>
      </div>

      {/* Feedback Banner */}
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
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="text-sm font-semibold">{feedback.message}</div>
        </div>
      )}

      {/* System Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Control 1: System Suspension (SRS 2.2.2 Exception 1) */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Trading Suspension Control (SRS 2.2.2)
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isSuspended
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}
            >
              {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tests SRS Exception 1: <em>"all the operations have been suspended"</em>. When suspended, CTS rejects all buy, sell, cancel, and matching requests with an explicit suspension error.
          </p>
          <button
            onClick={handleToggleSuspend}
            className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
              isSuspended
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950'
            }`}
          >
            {isSuspended ? (
              <>
                <PlayCircle className="w-4 h-4" />
                Resume Trading Operations
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4" />
                Suspend All Operations (Test Exception 1)
              </>
            )}
          </button>
        </div>

        {/* Control 2: Outdated Instruction Sweeper (SRS R05) */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              Outdated Instruction Sweeper (SRS 7.2.4 & R05)
            </h2>
            <span className="text-xs text-slate-400">1 Day Default</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            SRS 7.2.4: <em>"If an instruction haven't finished it's trading in one day, then it will be removed from CTS for out of date."</em> Marks status EXPIRED and releases reserved funds.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] text-slate-400 mb-1">
                Threshold (Hours) — Use 24 for SRS, or 0.01 for fast test:
              </label>
              <input
                type="number"
                step="0.01"
                value={sweepHours}
                onChange={(e) => setSweepHours(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={handleSweepOutdated}
              className="mt-5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition"
            >
              Trigger Sweep
            </button>
          </div>
        </div>
      </div>

      {/* Stock Limits Configuration (SRS R04) */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          R04 Rising & Falling Limit Configuration
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Symbol</th>
                <th className="px-4 py-2.5">Stock Name</th>
                <th className="px-4 py-2.5 text-right">Falling Limit</th>
                <th className="px-4 py-2.5 text-right">Rising Limit</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data?.stocks?.map((stock) => {
                const isEditing = editingStock === stock.symbol;
                return (
                  <tr key={stock.stockId} className="hover:bg-slate-850/50">
                    <td className="px-4 py-3 font-bold text-white">{stock.symbol}</td>
                    <td className="px-4 py-3 text-slate-400 font-sans">{stock.name}</td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editFalling}
                          onChange={(e) => setEditFalling(e.target.value)}
                          className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right text-rose-400"
                        />
                      ) : (
                        <span className="text-rose-400">${Number(stock.fallingLimit).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editRising}
                          onChange={(e) => setEditRising(e.target.value)}
                          className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right text-emerald-400"
                        />
                      ) : (
                        <span className="text-emerald-400">${Number(stock.risingLimit).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleSaveStockLimits(stock.symbol)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingStock(null)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEditStock(stock)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px]"
                        >
                          Edit Limits
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Accounts Inspector (R06) */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          Security Account Management Ledger (R06 Fund Freezing)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Account ID</th>
                <th className="px-4 py-2.5">User ID</th>
                <th className="px-4 py-2.5 text-right">Total Balance</th>
                <th className="px-4 py-2.5 text-right">Available Balance</th>
                <th className="px-4 py-2.5 text-right">Frozen Balance</th>
                <th className="px-4 py-2.5">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data?.accounts?.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-850/50">
                  <td className="px-4 py-2.5 text-slate-400">{acc.id}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-200">{acc.userId}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-white">
                    ${Number(acc.totalBalance).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-400">
                    ${Number(acc.availableBalance).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-amber-400">
                    ${Number(acc.frozenBalance).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-[11px] font-sans">
                    {new Date(acc.updatedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTS System Audit Logs (SRS 3.3 / CRC Cards) */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-slate-400" />
          CTS Pretreatment & Dealing Audit Logs (SRS 3.3 / CRC Log Instruction)
        </h2>
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 max-h-64 overflow-y-auto space-y-1.5">
          {data?.logs?.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900 p-1 rounded">
              <span className="text-slate-500 shrink-0">
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>
              <span className="text-emerald-400 font-bold shrink-0">{log.action}:</span>
              <span className="text-slate-300">{JSON.stringify(log.details)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
