import React, { useContext } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Spin, Layout } from 'antd';
import { useTranslation } from 'react-i18next';

// Import Layout and Pages
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
// Import the wrapper instead of the direct page for routing
import RequestManagementPageWrapper from './pages/RequestManagementPageWrapper';
import LogViewerPage from './pages/LogViewerPage';
import SettingsPage from './pages/SettingsPage';

// Import Auth Provider and Hook
import { AuthProvider, useAuth } from './contexts/AuthContext';

// --- Protected Route Component ---
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    // Show a loading indicator while checking auth status
    return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip={t('common.loading') || 'Loading authentication...'} />
      </Layout>
    );
  }

  if (!isAuthenticated) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>; // Render children if authenticated
};
// --- End Protected Route Component ---


// --- App Component (Defines Routes) ---
function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth(); // Get login function from context

  // Handle successful login (passed to LoginPage)
  const handleLoginSuccess = (token: string) => {
    login(token); // Update auth context (will trigger profile fetch)
    const from = location.state?.from?.pathname || '/dashboard'; // Redirect to dashboard or intended page
    navigate(from, { replace: true });
  };

  return (
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout /> {/* MainLayout now contains the Outlet for nested routes */}
            </ProtectedRoute>
          }
        >
           {/* Nested routes rendered inside MainLayout's Outlet */}
           <Route path="dashboard" element={<DashboardPage />} />
           {/* Use the wrapper component for the requests route */}
           <Route path="requests" element={<RequestManagementPageWrapper />} />
           <Route path="logs" element={<LogViewerPage />} />
           <Route path="settings" element={<SettingsPage />} />
           {/* Default route within protected area */}
           <Route index element={<Navigate to="dashboard" replace />} />
           {/* Catch-all for unknown protected routes */}
           <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
  );
}

// Wrap the AppRoutes component with the AuthProvider
const RootApp: React.FC = () => (
  <AuthProvider>
      <AppRoutes />
  </AuthProvider>
);

export default RootApp; // Export the wrapped App
