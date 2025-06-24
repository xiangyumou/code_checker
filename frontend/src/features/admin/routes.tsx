import React from 'react';
import { Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import RequestManagementPageWrapper from './pages/RequestManagementPageWrapper';
import LogViewerPage from './pages/LogViewerPage';
import SettingsPage from './pages/SettingsPage';

export const adminRoutes = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: 'dashboard', element: <DashboardPage /> },
  { path: 'requests', element: <RequestManagementPageWrapper /> },
  { path: 'logs', element: <LogViewerPage /> },
  { path: 'settings', element: <SettingsPage /> },
  { path: '*', element: <Navigate to="dashboard" replace /> },
];