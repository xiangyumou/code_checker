import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Spin, Layout, App as AntdApp } from 'antd';
import UserAppPage from './features/user/UserAppPage';
import AdminLayout from './features/admin/layouts/AdminLayout';
import LoginPage from './features/admin/pages/LoginPage';
import DashboardPage from './features/admin/pages/DashboardPage';
import RequestManagementPageWrapper from './features/admin/pages/RequestManagementPageWrapper';
import LogViewerPage from './features/admin/pages/LogViewerPage';
import SettingsPage from './features/admin/pages/SettingsPage';
import { SecureAuthProvider, useSecureAuth } from './features/admin/contexts/SecureAuthContext';

const LoginPageWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useSecureAuth();

  const handleLoginSuccess = async (username: string, password: string) => {
    const result = await login(username, password);
    if (result.success) {
      const from = location.state?.from?.pathname || '/admin/dashboard';
      navigate(from, { replace: true });
    }
    return result;
  };

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useSecureAuth();

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip="正在加载认证信息..." />
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <UserAppPage />,
  },
  {
    path: '/login',
    element: (
      <SecureAuthProvider>
        <LoginPageWrapper />
      </SecureAuthProvider>
    ),
  },
  {
    path: '/admin',
    element: (
      <SecureAuthProvider>
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      </SecureAuthProvider>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'requests', element: <RequestManagementPageWrapper /> },
      { path: 'logs', element: <LogViewerPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="dashboard" replace /> },
    ],
  },
]);

function App() {
  return (
    <AntdApp>
      <RouterProvider router={router} />
    </AntdApp>
  );
}

export default App;