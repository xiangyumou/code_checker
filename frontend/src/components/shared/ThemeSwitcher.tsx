import React from 'react';
import { Dropdown, Button, MenuProps, Space } from 'antd';
import { SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';

const ThemeSwitcher: React.FC = () => {
  const { themeMode, setThemeMode } = useTheme();
  const { t } = useTranslation();

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    // Type assertion as MenuInfo might not strictly conform, but key is what we need
    const selectedMode = e.key as ThemeMode;
    // Theme mode selected: ${selectedMode}
    setThemeMode(selectedMode);
  };

  const items: MenuProps['items'] = [
    {
      key: 'light',
      icon: <SunOutlined />,
      label: t('themeSwitcher.light'),
    },
    {
      key: 'dark',
      icon: <MoonOutlined />,
      label: t('themeSwitcher.dark'),
    },
    {
      key: 'auto',
      icon: <DesktopOutlined />,
      label: t('themeSwitcher.auto'),
    },
  ];

  // Determine the icon to display on the button based on the current mode
  const CurrentIcon = () => {
    switch (themeMode) {
      case 'light':
        return <SunOutlined />;
      case 'dark':
        return <MoonOutlined />;
      case 'auto':
      default:
        return <DesktopOutlined />;
    }
  };

  return (
    <Dropdown menu={{ items, onClick: handleMenuClick, selectedKeys: [themeMode] }} placement="bottomRight">
      {/* Use a Button for better styling and interaction */}
      <Button type="text" icon={<CurrentIcon />} shape="circle" aria-label={t('themeSwitcher.toggleAriaLabel')} style={{ outline: 'none' }} />
       {/*
         Alternatively, show text alongside icon:
         <Button type="text" icon={<CurrentIcon />}>
             {themeMode === 'light' ? '亮色' : themeMode === 'dark' ? '暗色' : '自动'}
         </Button>
       */}
    </Dropdown>
  );
};

export default ThemeSwitcher;