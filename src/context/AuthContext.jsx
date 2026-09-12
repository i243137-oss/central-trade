import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('cts_token');
    if (!token) {
      setUser(null);
      setAccount(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.success && res.data) {
        setUser(res.data.user);
        setAccount(res.data.account);
      } else {
        localStorage.removeItem('cts_token');
        setUser(null);
        setAccount(null);
      }
    } catch (err) {
      console.error('[AuthContext] Session validation error:', err);
      localStorage.removeItem('cts_token');
      setUser(null);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    if (res.success && res.data) {
      localStorage.setItem('cts_token', res.data.token);
      setUser(res.data.user);
      setAccount(res.data.account);
      return res.data;
    }
    throw new Error(res.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    if (res.success && res.data) {
      localStorage.setItem('cts_token', res.data.token);
      setUser(res.data.user);
      setAccount(res.data.account);
      return res.data;
    }
    throw new Error(res.message || 'Registration failed');
  };

  const logout = () => {
    localStorage.removeItem('cts_token');
    setUser(null);
    setAccount(null);
  };

  const refreshAccount = async () => {
    try {
      const res = await api.getMyAccount();
      if (res.success && res.data) {
        setAccount(res.data);
      }
    } catch (err) {
      console.error('[AuthContext] Error refreshing account:', err);
    }
  };

  const value = {
    user,
    account,
    loading,
    isManager: user?.role === 'SYSTEM_MANAGER',
    login,
    register,
    logout,
    refreshAccount
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
