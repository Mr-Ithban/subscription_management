import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthContext from '../auth/AuthContext';
import {
  clearStoredToken,
  getCurrentUser,
  getStoredToken,
  loginRequest,
  signupRequest,
  storeToken,
} from '../api/auth';

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, customer: null, loading: true });

  const clearSession = useCallback(() => {
    clearStoredToken();
    setSession({ user: null, customer: null, loading: false });
  }, []);

  const refreshSession = useCallback(async () => {
    if (!getStoredToken()) {
      setSession({ user: null, customer: null, loading: false });
      return null;
    }

    try {
      const profile = await getCurrentUser();
      setSession({ user: profile.user, customer: profile.customer, loading: false });
      return profile.user;
    } catch (error) {
      clearSession();
      throw error;
    }
  }, [clearSession]);

  useEffect(() => {
    let active = true;

    async function restore() {
      if (!getStoredToken()) {
        if (active) setSession({ user: null, customer: null, loading: false });
        return;
      }

      try {
        const profile = await getCurrentUser();
        if (active) setSession({ user: profile.user, customer: profile.customer, loading: false });
      } catch {
        clearStoredToken();
        if (active) setSession({ user: null, customer: null, loading: false });
      }
    }

    restore();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await loginRequest(credentials);
    storeToken(result.token);
    try {
      const profile = await getCurrentUser();
      setSession({ user: profile.user, customer: profile.customer, loading: false });
      return profile.user;
    } catch (error) {
      clearSession();
      throw error;
    }
  }, [clearSession]);

  const signup = useCallback((details) => signupRequest(details), []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(() => ({
    user: session.user,
    role: session.user?.role ?? null,
    customer: session.customer,
    loading: session.loading,
    isAuthenticated: Boolean(session.user),
    login,
    signup,
    logout,
    refreshSession,
  }), [session, login, signup, logout, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
