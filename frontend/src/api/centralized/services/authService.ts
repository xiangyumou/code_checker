/**
 * Centralized authentication service
 */

import { adminApiClient } from '../clients';
import type { AdminUser } from '../../../types/index';

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
}

export class AuthService {
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    // Use form data for login as backend expects form data
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    return adminApiClient.upload<LoginResponse>('/login/access-token', formData);
  }

  static async getCurrentUser(): Promise<AdminUser> {
    // Use test-token endpoint to get current user info
    return adminApiClient.post<AdminUser>('/login/test-token', {});
  }

  static async updateProfile(data: { username?: string; password?: string }): Promise<AdminUser> {
    return adminApiClient.put<AdminUser>('/admin/profile/me', data);
  }

  static logout(): void {
    adminApiClient.updateAuthToken(null);
  }
}