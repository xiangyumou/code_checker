import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { 
  GlobalOutlined, 
  SunOutlined, 
  MoonOutlined, 
  DesktopOutlined,
  MacCommandOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { Dropdown } from '../ui/Dropdown';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '@/shared/lib/utils';

interface HeaderProps {
  showWebSocketStatus?: boolean;
  isConnected?: boolean;
  rightContent?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ 
  showWebSocketStatus = false, 
  isConnected = false,
  rightContent 
}) => {
  const { t, i18n } = useTranslation();
  const { themeMode, setThemeMode } = useTheme();

  const languages = [
    { code: 'en-US', label: 'English' },
    { code: 'zh-CN', label: '中文' },
    { code: 'de-DE', label: 'Deutsch' },
  ];

  const themes = [
    { value: 'light', label: t('theme.light'), icon: <SunOutlined /> },
    { value: 'dark', label: t('theme.dark'), icon: <MoonOutlined /> },
    { value: 'auto', label: t('theme.auto'), icon: <DesktopOutlined /> },
  ];

  return (
    <div className="h-16 px-6 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            C
          </div>
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Code Checker
          </span>
        </Link>
        
        {showWebSocketStatus && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
            isConnected 
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {isConnected ? <WifiOutlined /> : <DisconnectOutlined />}
            {isConnected ? t('common.connected') : t('common.disconnected')}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 dark:text-gray-400"
          onClick={() => {
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              ctrlKey: true,
            });
            document.dispatchEvent(event);
          }}
        >
          <MacCommandOutlined className="text-base" />
          <span className="hidden sm:inline">⌘K</span>
        </Button>
        
        <Dropdown
          items={languages.map(lang => ({
            key: lang.code,
            label: lang.label,
            onClick: () => i18n.changeLanguage(lang.code),
          }))}
          placement="bottomEnd"
        >
          <Button variant="ghost" size="sm" icon={<GlobalOutlined />}>
            {languages.find(l => l.code === i18n.language)?.label || 'English'}
          </Button>
        </Dropdown>
        
        <Dropdown
          items={themes.map(themeOption => ({
            key: themeOption.value,
            label: themeOption.label,
            icon: themeOption.icon,
            onClick: () => setThemeMode(themeOption.value as any),
          }))}
          placement="bottomEnd"
        >
          <Button variant="ghost" size="sm" icon={themes.find(t => t.value === themeMode)?.icon}>
            {themes.find(t => t.value === themeMode)?.label}
          </Button>
        </Dropdown>
        
        {rightContent}
      </div>
    </div>
  );
};