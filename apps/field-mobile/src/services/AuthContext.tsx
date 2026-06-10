import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import ApiService from './ApiService';
import { UserRole } from '@equuscronos/shared';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const storedToken = await SecureStore.getItemAsync('auth_token');
        const storedUser = await SecureStore.getItemAsync('auth_user');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.warn('[AuthContext] Error loading auth from SecureStore:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${ApiService.getBaseUrl()}/auth/login`, {
        email,
        password,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': '77777777-7777-7777-7777-777777777777',
        }
      });

      const { access_token, user: loggedUser } = response.data;
      
      await SecureStore.setItemAsync('auth_token', access_token);
      await SecureStore.setItemAsync('auth_user', JSON.stringify(loggedUser));
      
      setToken(access_token);
      setUser(loggedUser);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error.message || 'Error de autenticación';
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('auth_user');
    } catch (e) {
      console.warn('[AuthContext] Error clearing auth stores:', e);
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
