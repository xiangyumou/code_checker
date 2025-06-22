import React from 'react';
import { Dropdown, Button, MenuProps, Space } from 'antd';
import { SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { useTheme, ThemeMode } from '../contexts/ThemeContext'; // Adjust path as needed

const ThemeSwitcher: React.FC = () => {
  const { themeMode, setThemeMode } = useTheme();

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    // Type assertion as MenuInfo might not strictly conform, but key is what we need
    const selectedMode = e.key as ThemeMode;
    console.log(`[ThemeSwitcher] Mode selected: ${selectedMode}`);
    setThemeMode(selectedMode);
  };

  const items: MenuProps['items'] = [
    {
      key: 'light',
      icon: <SunOutlined />,
      label: '亮色模式',
    },
    {
      key: 'dark',
      icon: <MoonOutlined />,
      label: '暗色模式',
    },
    {
      key: 'auto',
      icon: <DesktopOutlined />,
      label: '跟随系统',
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
      <Button type="text" icon={<CurrentIcon />} shape="circle" aria-label="切换主题模式" />
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