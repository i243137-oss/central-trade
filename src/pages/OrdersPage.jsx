import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FileText,
  XCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Filter
} from 'lucide-react';

export default function OrdersPage() {
  const { user, isManager, refreshAccount } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewAll, setViewAll] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (isManager && viewAll) {
        params.all = 'true';
      }
      if (filterStatus !== 'ALL') {
        params.status = filterStatus;
      }
      const res = await api.getInstructions(params);
      if (res.success) {
        setOrders(res.data || []);
      }
    } catch (err) {
      console.error('[OrdersPage] Error loading instructions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filterStatus, viewAll]);

  const handleCancel = async (instructionId) => {
    setFeedback(null);
    setCancellingId(instructionId);

    try {
      const res = await api.cancelInstruction(instructionId);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Instruction cancelled successfully.'
        });
        refreshAccount();
        fetchOrders();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to cancel instruction.',
        errorCode: err.errorCode
      });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Trading Instructions & Cancellation (SRS R02)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your submitted instructions. Cancel active instructions to release reserved funds.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
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
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <div className="font-semibold">{feedback.message}</div>
            {feedback.errorCode && (
              <div className="text-xs text-rose-300/80 mt-0.5 font-mono">
                Code: {feedback.errorCode}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-300">Filter Status:</span>
          {['ALL', 'PENDING', 'PARTIALLY_FINISHED', 'TOTALLY_FINISHED', 'CANCELLED', 'EXPIRED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterStatus === st
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {isManager && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-amber-300 font-semibold">
              <input
                type="checkbox"
                checked={viewAll}
                onChange={(e) => setViewAll(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-amber-500"
              />
              <span>View All Users' Instructions (Manager Mode)</span>
            </label>
          </div>
        )}
      </div>

      {/* Instructions Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Instruction ID</th>
                {isManager && viewAll && <th className="px-4 py-3">User</th>}
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3 text-right">Respected Price</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-slate-500">
                    Loading instructions...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-slate-500">
                    No instructions found matching criteria.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const canCancel = ord.status === 'PENDING' || ord.status === 'PARTIALLY_FINISHED';
                  return (
                    <tr key={ord.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-200">
                        {ord.id}
                      </td>
                      {isManager && viewAll && (
                        <td className="px-4 py-3 text-slate-400">
                          {ord.userId}
                        </td>
                      )}
                      <td className="px-4 py-3 font-bold text-white">
                        {ord.stockId}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            ord.type === 'BUY'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {ord.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {ord.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-300">
                        {ord.remainingQuantity}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        ${Number(ord.respectedPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px] font-sans">
                        {new Date(ord.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
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
                      </td>
                      <td className="px-4 py-3 text-center font-sans">
                        {canCancel ? (
                          <button
                            onClick={() => handleCancel(ord.id)}
                            disabled={cancellingId === ord.id}
                            className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[11px] font-medium transition disabled:opacity-50"
                          >
                            {cancellingId === ord.id ? 'Cancelling...' : 'Cancel (R02)'}
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[11px]">—</span>
                        )}
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
