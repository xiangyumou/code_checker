import React from 'react';
import { Navigate } from 'react-router-dom';
import { ModernDashboardPage } from './pages/ModernDashboardPage';
import { ModernRequestManagementPage } from './pages/ModernRequestManagementPage';
import { ModernLogViewerPage } from './pages/ModernLogViewerPage';
import { ModernSettingsPage } from './pages/ModernSettingsPage';

export const adminRoutes = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: 'dashboard', element: <ModernDashboardPage /> },
  { path: 'requests', element: <ModernRequestManagementPage /> },
  { path: 'logs', element: <ModernLogViewerPage /> },
  { path: 'settings', element: <ModernSettingsPage /> },
  { path: '*', element: <Navigate to="dashboard" replace /> },
];