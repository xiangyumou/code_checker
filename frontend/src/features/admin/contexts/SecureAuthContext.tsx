import React, { useState, createContext, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { secureAuthService } from '../services/secureAuth';
import { AdminUser } from '../../../types/index';

interface SecureAuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const SecureAuthContext = createContext<SecureAuthContextType | null>(null);

export const SecureAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await secureAuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setLoading(false);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const result = await secureAuthService.checkAuth();
      if (result.success && result.user) {
        setUser(result.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const result = await secureAuthService.login(username, password);
      if (result.success) {
        // After successful login, fetch user data
        await checkAuth();
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Login failed' };
    } finally {
      setLoading(false);
    }
  }, [checkAuth]);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Set up periodic token refresh
  useEffect(() => {
    if (!user) return;

    let refreshDisabled = false;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    const clearRefreshInterval = () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    };

    const handleRefresh = async () => {
      if (refreshDisabled) {
        return;
      }

      try {
        const result = await secureAuthService.refreshToken();

        if (!result.refreshSupported) {
          refreshDisabled = true;
          clearRefreshInterval();
          return;
        }

        if (result.success && result.user) {
          setUser(result.user);
        } else if (!result.success) {
          await logout();
        }
      } catch (error) {
        if (!refreshDisabled) {
          console.error('Token refresh error:', error);
          await logout();
        }
      }
    };

    refreshInterval = setInterval(handleRefresh, 30 * 60 * 1000); // Refresh every 30 minutes

    return () => {
      refreshDisabled = true;
      clearRefreshInterval();
    };
  }, [user, logout]);

  const isAuthenticated = !!user;

  return (
    <SecureAuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      loading, 
      login, 
      logout, 
      checkAuth 
    }}>
      {children}
    </SecureAuthContext.Provider>
  );
};

export const useSecureAuth = () => {
  const context = useContext(SecureAuthContext);
  if (!context) {
    throw new Error('useSecureAuth must be used within a SecureAuthProvider');
  }
  return context;
};