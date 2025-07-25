import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';

// Define the possible theme modes
export type ThemeMode = 'light' | 'dark' | 'auto';

// Define the shape of the context data
interface ThemeContextProps {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  // effectiveTheme is derived inside the provider, useful for direct consumption if needed elsewhere
  // but primary use is within ConfigProvider wrapper
  effectiveTheme: 'light' | 'dark';
}

// Create the context with a default value (or null and check for provider existence)
const ThemeContext = createContext<ThemeContextProps | null>(null);

// Define the props for the provider component
interface ThemeProviderProps {
  children: React.ReactNode;
}

// Helper function to get the initial theme mode from localStorage
const getInitialThemeMode = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const storedMode = localStorage.getItem('themeMode');
    if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'auto') {
      return storedMode;
    }
  }
  return 'auto'; // Default to 'auto'
};

// Helper function to check OS preference
const prefersDarkMode = (): boolean => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false; // Default to light if matchMedia is not supported
};


export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);
  const [isOsDark, setIsOsDark] = useState<boolean>(prefersDarkMode);

  // Update OS preference state when system setting changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            // console.log(`[ThemeProvider] OS color scheme changed. Dark: ${mediaQuery.matches}`); // Removed log
            setIsOsDark(mediaQuery.matches);
        };
        mediaQuery.addEventListener('change', handleChange);
        // Cleanup listener on component unmount
        return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  // Persist themeMode to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
        // console.log(`[ThemeProvider] Persisting themeMode to localStorage: ${themeMode}`); // Removed log
        localStorage.setItem('themeMode', themeMode);
    }
  }, [themeMode]);

  // Determine the effective theme based on themeMode and OS preference
  const effectiveTheme = useMemo((): 'light' | 'dark' => {
    const calculatedTheme = themeMode === 'auto' ? (isOsDark ? 'dark' : 'light') : themeMode;
      // console.log(`[ThemeProvider] Calculating effectiveTheme: mode='${themeMode}', isOsDark=${isOsDark}, effective='${calculatedTheme}'`); // Removed log
      return calculatedTheme;
    }, [themeMode, isOsDark]);

// Apply theme class to root element
  useEffect(() => {
    const root = window.document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);
  // Memoize setThemeMode to prevent unnecessary re-renders of consumers
  const setThemeMode = useCallback((mode: ThemeMode) => {
    // console.log(`[ThemeProvider] setThemeMode called with: ${mode}`); // Removed log
    setThemeModeState(mode);
  }, []);

  // Memoize the context value
  const contextValue = useMemo(() => ({
    themeMode,
    setThemeMode,
    effectiveTheme,
  }), [themeMode, setThemeMode, effectiveTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for easy consumption of the theme context
export const useTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};