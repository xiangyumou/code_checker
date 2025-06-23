/**
 * Centralized API client instances
 * Creates configured instances for user and admin use
 */

import { CentralizedApiClient } from './core';

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
  authTokenKey: 'admin_token',
  onAuthFailure: () => {
    // Redirect to login on auth failure
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  },
});

// Utility functions to maintain backward compatibility
export const updateAuthToken = (token: string) => {
  adminApiClient.updateAuthToken(token);
};

// Export for direct usage where needed
export { CentralizedApiClient };