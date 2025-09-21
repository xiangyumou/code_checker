import React, { useState, createContext, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProfile } from '../api/auth'; // Adjust path if needed
import { updateAuthToken } from '@/api/centralized'; // Import token update function
import { AdminUser } from '../../../types/index'; // Import from shared types
import { ADMIN_AUTH_TOKEN_KEY } from '@/constants/adminAuth';

interface AuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  loading: boolean; // Add loading state for initial auth check
  login: (token: string) => void; // Removed username, will fetch profile
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_AUTH_TOKEN_KEY));
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Start loading initially
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
    // Navigate to login page after state updates
    navigate('/login', { replace: true });
  }, [navigate]);

  const fetchUserProfile = useCallback(async (currentToken: string) => {
    try {
      // Ensure the token is passed correctly if needed by getMyProfile
      // Assuming axiosInstance handles the token automatically from localStorage
      const profileData = await getMyProfile();
      setUser(profileData);
    } catch (error) {
      console.error("AuthProvider: Failed to fetch user profile:", error);
      // If profile fetch fails (e.g., invalid token), log out
      logout();
    }
  }, [logout]);

  // Check authentication status and fetch profile on mount or token change
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken); // Ensure token state is synced
        await fetchUserProfile(storedToken);
      } else {
        setUser(null); // Clear user if no token
      }
      setLoading(false); // Finished loading/checking auth
    };
    checkAuth();
  }, [fetchUserProfile]); // Run when fetchUserProfile changes (should be stable)

  const login = (newToken: string) => {
    setLoading(true); // Set loading while logging in and fetching profile
    localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, newToken);
    setToken(newToken);
    // Update the API client with the new token
    updateAuthToken(newToken);
    // Fetch profile immediately after setting token
    fetchUserProfile(newToken).finally(() => {
        setLoading(false);
        // Navigation should happen in LoginPage after successful login call
    });
  };


  const isAuthenticated = !!token && !!user; // Consider authenticated only if token AND user exist

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout }}>
      {/* Render children only after initial loading is complete */}
      {!loading ? children : null /* Or show a global spinner */}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};