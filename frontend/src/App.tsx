import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Spin, Layout, App as AntdApp } from 'antd';
import { UserApp } from './features/user/UserApp';
import ModernAdminLayout from './features/admin/layouts/ModernAdminLayout';
import { ModernLoginPage } from './features/admin/pages/ModernLoginPage';
import { SecureAuthProvider, useSecureAuth } from './features/admin/contexts/SecureAuthContext';
import { adminRoutes } from './features/admin/routes';

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

  return <ModernLoginPage onLoginSuccess={handleLoginSuccess} />;
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
    element: <UserApp />,
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
          <ModernAdminLayout />
        </ProtectedRoute>
      </SecureAuthProvider>
    ),
    children: adminRoutes,
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