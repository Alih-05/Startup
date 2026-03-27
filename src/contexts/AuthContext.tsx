import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  avatar_data?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (user: User, token: string) => void;
  updateUser: (user: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('rama_token'));
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      console.log('Checking authentication status...');
      const headers: any = { credentials: 'include' };
      if (token) {
        headers.headers = { 'Authorization': `Bearer ${token}` };
      }
      
      const res = await fetch('/api/me', headers);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          console.log('User authenticated:', data.user);
          setUser(data.user);
        } else {
          console.error('Expected JSON response but got:', await res.text());
          setUser(null);
        }
      } else {
        console.log('User not authenticated (Status:', res.status, ')');
        setUser(null);
        if (res.status === 401) {
          localStorage.removeItem('rama_token');
          setToken(null);
        }
      }
    } catch (err) {
      console.error('CheckAuth error:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = (userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('rama_token', userToken);
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    const headers: any = { method: 'POST', credentials: 'include' };
    if (token) {
      headers.headers = { 'Authorization': `Bearer ${token}` };
    }
    await fetch('/api/logout', headers);
    setUser(null);
    setToken(null);
    localStorage.removeItem('rama_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, updateUser, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
