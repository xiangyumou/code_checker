import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/AppShell';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { 
  DashboardOutlined,
  FileTextOutlined,
  FileSearchOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
  CloseOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Dropdown } from '@/components/ui/Dropdown';
import { useSecureAuth } from '../contexts/SecureAuthContext';
import { cn } from '@/shared/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const ModernAdminLayout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useSecureAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const menuItems = [
    {
      key: '/admin/dashboard',
      label: t('admin.dashboard.title'),
      icon: <DashboardOutlined />,
    },
    {
      key: '/admin/requests',
      label: t('admin.requests.title'),
      icon: <FileTextOutlined />,
    },
    {
      key: '/admin/logs',
      label: t('admin.logs.title'),
      icon: <FileSearchOutlined />,
    },
    {
      key: '/admin/settings',
      label: t('admin.settings.title'),
      icon: <SettingOutlined />,
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'user',
      label: user?.username || 'Admin',
      icon: <UserOutlined />,
      onClick: () => navigate('/admin/settings'),
    },
    {
      key: 'logout',
      label: t('admin.logout'),
      icon: <LogoutOutlined />,
      onClick: handleLogout,
      danger: true,
    },
  ];

  const sidebar = (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            A
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {t('admin.title')}
          </span>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                navigate(item.key);
                setMobileSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 w-1 h-8 bg-blue-600 dark:bg-blue-400 rounded-r"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          v1.0.0
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 lg:hidden"
          >
            <div className="absolute right-2 top-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileSidebarOpen(false)}
                icon={<CloseOutlined />}
              />
            </div>
            {sidebar}
          </motion.div>
        )}
      </AnimatePresence>

      <AppShell
        header={
          <Header
            rightContent={
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                  icon={<MenuOutlined />}
                  className="lg:hidden"
                />
                <Dropdown items={userMenuItems} placement="bottomEnd">
                  <Button variant="ghost" size="sm" icon={<UserOutlined />}>
                    {user?.username}
                  </Button>
                </Dropdown>
              </div>
            }
          />
        }
        sidebar={
          <div className={cn(
            "hidden lg:block transition-all duration-300",
            sidebarOpen ? "w-64" : "w-0 overflow-hidden"
          )}>
            {sidebar}
          </div>
        }
      >
        <Outlet />
      </AppShell>
    </>
  );
};

export default ModernAdminLayout;