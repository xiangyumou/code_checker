import React, { useState, useEffect, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import type { Locale } from 'antd/es/locale';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import deDE from 'antd/locale/de_DE';
import { useTranslation } from 'react-i18next';
import App from './App';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

import './i18n';
import './index.css';
import './styles/globals.css';
import 'antd/dist/reset.css';
import 'katex/dist/katex.min.css';

const baseThemeToken = {
  colorPrimary: '#00b96b',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorInfo: '#1677ff',
  borderRadius: 8,
  fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'`,
};

const localeMap: { [key: string]: Locale } = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'de-DE': deDE,
};

const AppWrapper = () => {
  const { effectiveTheme } = useTheme();
  const { i18n } = useTranslation();
  const [antdLocale, setAntdLocale] = useState<Locale>(localeMap[i18n.language] || enUS);

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setAntdLocale(localeMap[lng] || enUS);
    };

    const initialLangKey = i18n.resolvedLanguage ?? 'en-US';
    setAntdLocale(localeMap[initialLangKey] || enUS);

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  const algorithm = effectiveTheme === 'dark'
    ? theme.darkAlgorithm
    : theme.defaultAlgorithm;

  const dynamicThemeConfig = {
    token: baseThemeToken,
    algorithm: algorithm,
  };

  return (
    <ConfigProvider theme={dynamicThemeConfig} locale={antdLocale}>
      <App />
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <ThemeProvider>
        <AppWrapper />
      </ThemeProvider>
    </Suspense>
  </React.StrictMode>
);