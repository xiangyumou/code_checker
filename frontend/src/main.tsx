import { StrictMode, useState, useEffect } from 'react'; // Import useState and useEffect
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd'; // Import ConfigProvider and theme
import type { Locale } from 'antd/es/locale'; // Import Locale type
import enUS from 'antd/locale/en_US'; // Import Ant Design locales
import zhCN from 'antd/locale/zh_CN';
import deDE from 'antd/locale/de_DE';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import App from './App.tsx';
import { ThemeProvider, useTheme } from './contexts/ThemeContext'; // Import ThemeProvider and useTheme

import './i18n'; // Import and initialize i18next
// Import Ant Design styles
import 'antd/dist/reset.css'; // Ant Design v5 reset styles

// Import KaTeX styles for math rendering
import 'katex/dist/katex.min.css';

// Define the base token configuration (can be reused across themes)
const baseThemeToken = {
  // --- Color Palette ---
  colorPrimary: '#00b96b', // A vibrant green for primary actions and highlights
  colorSuccess: '#52c41a', // Standard success status green
  colorWarning: '#faad14', // Standard warning status orange
  colorError: '#ff4d4f',   // Standard error status red
  colorInfo: '#1677ff',    // Standard info status blue (Ant Design default)

  // --- Sizing & Spacing ---
  borderRadius: 8,         // Slightly larger radius for a softer, modern feel

  // --- Font ---
  // System font stack for broad compatibility and modern look
  fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'`,
};


// Map i18n language codes to Ant Design locale objects
const localeMap: { [key: string]: Locale } = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'de-DE': deDE,
};

// Create the AppWrapper component to apply the dynamic theme and locale
const AppWrapper = () => {
  const { effectiveTheme } = useTheme();
  const { i18n } = useTranslation(); // Get i18n instance

  // State for Ant Design locale
  const [antdLocale, setAntdLocale] = useState<Locale>(localeMap[i18n.language] || enUS);

  // Effect to update Ant Design locale when i18n language changes
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      // console.log(`[AppWrapper] Language changed to ${lng}. Updating AntD locale.`); // Removed log
      setAntdLocale(localeMap[lng] || enUS); // Update state with new locale or fallback
    };

    // Set initial locale based on resolved language, providing a fallback key
    const initialLangKey = i18n.resolvedLanguage ?? 'en-US';
    setAntdLocale(localeMap[initialLangKey] || enUS);

    // Subscribe to language changes
    i18n.on('languageChanged', handleLanguageChanged);

    // Cleanup subscription on component unmount
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]); // Depend on i18n instance

  // Determine the Ant Design theme algorithm based on the effective theme
  const algorithm = effectiveTheme === 'dark'
    ? theme.darkAlgorithm  // Use Ant Design's dark algorithm
    : theme.defaultAlgorithm; // Use Ant Design's default (light) algorithm

  // Combine the base token configuration with the dynamically selected algorithm
  const dynamicThemeConfig = {
    token: baseThemeToken,
    algorithm: algorithm,
  };

  // console.log(`[AppWrapper] Applying theme. Effective: ${effectiveTheme}, Algorithm used: ${algorithm === theme.darkAlgorithm ? 'darkAlgorithm' : 'defaultAlgorithm'}`); // Removed log

  // Render the ConfigProvider with dynamic theme and locale config, wrapping the main App
  return (
    <ConfigProvider theme={dynamicThemeConfig} locale={antdLocale}>
      <App />
    </ConfigProvider>
  );
};


// Render the application
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Wrap the AppWrapper with ThemeProvider to provide theme context */}
    <ThemeProvider>
      <AppWrapper />
    </ThemeProvider>
  </StrictMode>,
);
