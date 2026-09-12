import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  LayoutDashboard,
  Layers,
  FileText,
  Clock,
  Search,
  ShieldCheck,
  LogOut,
  User,
  Wallet
} from 'lucide-react';

export default function Navbar() {
  const { user, account, isManager, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/trade', label: 'Trade', icon: TrendingUp },
    { path: '/orders', label: 'Orders', icon: FileText },
    { path: '/order-book', label: 'Order Book', icon: Layers },
    { path: '/trades', label: 'Trades', icon: Clock },
    { path: '/query', label: 'SRS Query', icon: Search },
  ];

  if (isManager) {
    navItems.push({ path: '/manager', label: 'Manager Panel', icon: ShieldCheck, isSpecial: true });
  }

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Subsystem Info */}
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-sm">
                CTS
              </div>
              <div>
                <span className="font-semibold tracking-tight text-white block text-sm sm:text-base">
                  Central Trading System
                </span>
                <span className="text-[11px] text-slate-400 block -mt-0.5">
                  STS Subsystem (SRS v1.0)
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  } ${item.isSpecial ? 'text-amber-400 font-semibold' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Account Summary */}
          <div className="flex items-center gap-3">
            {account && (
              <div className="hidden lg:flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <div className="flex items-center gap-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Available:</span>
                    <span className="font-semibold text-emerald-400">
                      ${Number(account.availableBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="border-l border-slate-700 pl-2">
                    <span className="text-slate-400 block text-[10px]">Frozen:</span>
                    <span className="font-medium text-amber-400">
                      ${Number(account.frozenBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {user && (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-slate-200">{user.name}</div>
                  <div className="flex items-center justify-end gap-1">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        isManager
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex overflow-x-auto py-2 space-x-1 border-t border-slate-800 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1 px-2.5 py-1 rounded whitespace-nowrap ${
                  isActive ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
