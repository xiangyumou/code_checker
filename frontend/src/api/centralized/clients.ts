/**
 * Centralized API client instances
 * Creates configured instances for user and admin use
 */

import { CentralizedApiClient } from './core';
import { createWebSocketManager, createWebSocketHook } from '@shared/websocket/manager';
import { createCommunicationConfig } from '@shared/config/index';
import { ADMIN_AUTH_TOKEN_KEY } from '@/constants/adminAuth';

// User API client (no authentication)
export const userApiClient = new CentralizedApiClient({
  baseURL: '/api/v1',
  timeout: 10000,
  withAuth: false,
});

// Admin API client (with authentication)
export const adminApiClient = new CentralizedApiClient({
  baseURL: '/api/v1',
  timeout: 15000,
  withAuth: true,
  authTokenKey: ADMIN_AUTH_TOKEN_KEY,
  onAuthFailure: () => {
    // Redirect to login on auth failure
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  },
});

// WebSocket manager and hook
const communicationConfig = createCommunicationConfig('frontend');
const webSocketManager = createWebSocketManager(communicationConfig);
export const useWebSocket = createWebSocketHook(webSocketManager);

// Utility functions to maintain backward compatibility
export const updateAuthToken = (token: string) => {
  adminApiClient.updateAuthToken(token);
};

// Export for direct usage where needed
export { CentralizedApiClient };
