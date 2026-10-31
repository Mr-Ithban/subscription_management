/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    // Default demo user with ADMIN role
    return {
      id: 'admin-1',
      name: 'System Admin',
      email: 'admin@brightloop.test',
      role: 'ADMIN',
    };
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || 'demo-token');

  useEffect(() => {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  const switchRole = (newRole) => {
    setUser((prev) => ({
      ...prev,
      role: newRole,
      name: newRole === 'ADMIN' ? 'System Admin' : 'Staff Member',
      email: `${newRole.toLowerCase()}@brightloop.test`,
    }));
  };

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('auth_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || 'GUEST',
        isAdmin: user?.role === 'ADMIN',
        isStaff: user?.role === 'STAFF',
        switchRole,
        login,
        logout,
      }}
    >
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
