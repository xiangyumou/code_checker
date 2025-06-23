import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Sider } = Layout;
const { Title } = Typography;

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  children?: MenuItem[];
}

interface AdminSidebarProps {
  menuItems: MenuItem[];
  selectedKey: string;
  openKeys: string[];
  onMenuClick: (key: string) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  menuItems,
  selectedKey,
  openKeys,
  onMenuClick,
}) => {
  const { t } = useTranslation();

  return (
    <Sider breakpoint="lg" collapsedWidth="0" theme="dark">
      <div style={{ 
        height: '32px', 
        margin: '16px', 
        background: 'rgba(255, 255, 255, 0.2)', 
        borderRadius: '6px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Title level={5} style={{ color: 'white', margin: 0 }}>
          {t('adminPanel.title')}
        </Title>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={openKeys}
        onClick={({ key }: { key: string }) => onMenuClick(key)}
        items={menuItems}
      />
    </Sider>
  );
};

export default AdminSidebar;