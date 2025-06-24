import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSecureAuth } from '../contexts/SecureAuthContext';
import { 
  DashboardOutlined, 
  DatabaseOutlined, 
  FileTextOutlined,
  MonitorOutlined, 
  SettingOutlined,
  UserOutlined,
  LogoutOutlined 
} from '@ant-design/icons';

export const useAdminNavigation = () => {
  const { t } = useTranslation();
  const { logout, user } = useSecureAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = useMemo(() => [
    { key: '/admin/dashboard', icon: <DashboardOutlined />, label: t('dashboard.title') },
    { key: '/admin/requests', icon: <DatabaseOutlined />, label: t('requestManagement.title') },
    {
      key: 'monitoring', 
      icon: <MonitorOutlined />, 
      label: t('systemMonitoring.title'),
      children: [
        { key: '/admin/logs', icon: <FileTextOutlined />, label: t('admin.logs.title') },
      ],
    },
    {
      key: 'settings', 
      icon: <SettingOutlined />, 
      label: t('settingsPage.title'),
      children: [
        { key: '/admin/settings', label: t('settingsPage.appAndProfile') },
      ],
    },
  ], [t]);

  const getCurrentPathKeys = useCallback(() => {
    const path = location.pathname;
    let openKey = '';
    
    for (const item of menuItems) {
      if (item.children) {
        for (const child of item.children) {
          if (child.key === path) {
            openKey = item.key;
            break;
          }
        }
      }
      if (openKey) break;
    }
    
    if (path === '/admin/settings' && !openKey) {
      const settingsParent = menuItems.find(item => item.key === 'settings');
      if (settingsParent) openKey = settingsParent.key;
    }
    
    return { selectedKey: path, openKey: openKey ? [openKey] : [] };
  }, [location.pathname, menuItems]);

  const breadcrumbNameMap = useMemo(() => ({
    '/admin/dashboard': t('dashboard.title'),
    '/admin/requests': t('requestManagement.title'),
    '/admin/monitoring': t('systemMonitoring.title'),
    '/admin/logs': t('admin.logs.title'),
    '/admin/settings': t('settingsPage.title'),
  }), [t]);

  const getBreadcrumbItems = useCallback(() => {
    const pathSnippets = location.pathname.split('/').filter((i: string) => i);
    
    return [
      {
        key: 'home',
        title: <a onClick={() => navigate('/admin/dashboard')}>{t('dashboard.title')}</a>,
      },
      ...pathSnippets.map((_: string, index: number) => {
        const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
        const name = breadcrumbNameMap[url] || url.substring(url.lastIndexOf('/') + 1);
        const isLast = index === pathSnippets.length - 1;
        return {
          key: url,
          title: isLast ? name : <a onClick={() => navigate(url)}>{name}</a>,
        };
      }),
    ];
  }, [location.pathname, navigate, breadcrumbNameMap, t]);

  const handleUserMenuClick = useCallback((e: { key: string }) => {
    if (e.key === 'profile') {
      navigate('/admin/settings');
    } else if (e.key === 'logout') {
      logout();
    }
  }, [navigate, logout]);

  const userMenuItems = useMemo(() => [
    { key: 'profile', icon: <UserOutlined />, label: t('userMenu.profile') },
    { key: 'logout', icon: <LogoutOutlined />, label: t('logout') },
  ], [t]);

  const username = user?.username || 'Admin';

  return {
    menuItems,
    getCurrentPathKeys,
    getBreadcrumbItems,
    handleUserMenuClick,
    userMenuItems,
    username,
  };
};