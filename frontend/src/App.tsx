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
import { AuthProvider, useAuth } from './features/admin/contexts/AuthContext';

const LoginPageWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleLoginSuccess = (token: string) => {
    login(token);
    const from = location.state?.from?.pathname || '/admin/dashboard';
    navigate(from, { replace: true });
  };

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

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
      <AuthProvider>
        <LoginPageWrapper />
      </AuthProvider>
    ),
  },
  {
    path: '/admin',
    element: (
      <AuthProvider>
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      </AuthProvider>
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