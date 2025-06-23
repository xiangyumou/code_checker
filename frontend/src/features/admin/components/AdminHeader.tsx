import React from 'react';
import { Layout, theme, Breadcrumb, Dropdown, Avatar, Space, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import ThemeSwitcher from '../../../components/shared/ThemeSwitcher';
import LanguageSwitcher from '../../../components/shared/LanguageSwitcher';

const { Header } = Layout;
const { Text } = Typography;

interface BreadcrumbItem {
  key: string;
  title: React.ReactNode;
}

interface UserMenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

interface AdminHeaderProps {
  breadcrumbItems: BreadcrumbItem[];
  userMenuItems: UserMenuItem[];
  username: string;
  onUserMenuClick: (e: { key: string }) => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  breadcrumbItems,
  userMenuItems,
  username,
  onUserMenuClick,
}) => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <Header style={{ 
      padding: '0 16px', 
      background: colorBgContainer, 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center' 
    }}>
      <Breadcrumb items={breadcrumbItems} />
      <Space>
        <LanguageSwitcher />
        <ThemeSwitcher />
        <Dropdown 
          menu={{ items: userMenuItems, onClick: onUserMenuClick }} 
          placement="bottomRight"
        >
          <a 
            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault()} 
            style={{ cursor: 'pointer' }}
          >
            <Space>
              <Avatar size="small" icon={<UserOutlined />} />
              <Text>{username}</Text>
            </Space>
          </a>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default AdminHeader;