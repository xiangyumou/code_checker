import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import { ConfigProvider, theme } from 'antd'; // Import ConfigProvider and theme
import type { Locale } from 'antd/es/locale'; // Import Locale type
import enUS from 'antd/locale/en_US'; // Import Ant Design locales
import zhCN from 'antd/locale/zh_CN';
import deDE from 'antd/locale/de_DE';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import App from './App'; // Use .js/.jsx/.tsx extension optional
import { ThemeProvider, useTheme } from './contexts/ThemeContext'; // Import ThemeProvider and useTheme

import './i18n'; // Import and initialize i18next
// Import global styles
import './index.css';
// Import Ant Design styles
import 'antd/dist/reset.css'; // Ant Design v5 reset styles
// Import KaTeX styles for math rendering
import 'katex/dist/katex.min.css';

// Define the base token configuration (can be reused across themes)
const baseThemeToken = {
  colorPrimary: '#1677ff', // Ant Design default blue, adjust if needed
  // borderRadius: 6, // Example: slightly more rounded corners
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
      // Use default 'en-US' if lng is not in localeMap keys (should not happen with supportedLngs)
      setAntdLocale(localeMap[lng] || enUS);
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


  // Render the ConfigProvider with dynamic theme and locale config, wrapping the main App
  return (
    <ConfigProvider theme={dynamicThemeConfig} locale={antdLocale}>
      <App />
    </ConfigProvider>
  );
};


const container = document.getElementById('root');
const root = createRoot(container!); // Create a root.

root.render(
  <React.StrictMode> {/* Keep StrictMode if possible */}
    <BrowserRouter> {/* Wrap App with BrowserRouter */}
      {/* Wrap the AppWrapper with ThemeProvider to provide theme context */}
      <ThemeProvider>
        <AppWrapper />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
