/**
 * Secure authentication service using httpOnly cookies instead of localStorage
 * This prevents XSS attacks from accessing authentication tokens
 */

interface AuthResponse {
  success: boolean;
  user?: any;
  error?: string;
}

interface RefreshResponse extends AuthResponse {
  refreshSupported: boolean;
}

class SecureAuthService {
  private static instance: SecureAuthService;
  private baseUrl: string;
  private refreshSupported: boolean | null;

  private constructor() {
    this.baseUrl = '/api/v1'; // Adjust based on your API base URL
    this.refreshSupported = null;
  }

  public static getInstance(): SecureAuthService {
    if (!SecureAuthService.instance) {
      SecureAuthService.instance = new SecureAuthService();
    }
    return SecureAuthService.instance;
  }

  /**
   * Login with credentials and set httpOnly cookie
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Logout and clear httpOnly cookie
   */
  async logout(): Promise<void> {
    localStorage.removeItem('access_token');
    try {
      // The backend doesn't have a formal logout endpoint, but clearing the token locally is sufficient.
      await this.authenticatedFetch(`${this.baseUrl}/logout`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error (can be ignored if endpoint does not exist):', error);
    }
  }

  /**
   * Check if user is authenticated by trying to fetch profile
   */
  async checkAuth(): Promise<AuthResponse> {
    try {
      const response = await this.authenticatedFetch(`${this.baseUrl}/me`, {
        method: 'GET',
      });

      if (response.ok) {
        const user = await response.json();
        return { success: true, user };
      } else {
        return { success: false, error: 'Not authenticated' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Make authenticated API requests
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Refresh token if needed (handled automatically by httpOnly cookies)
   */
  async refreshToken(): Promise<RefreshResponse> {
    if (this.refreshSupported === false) {
      return { success: true, refreshSupported: false };
    }

    try {
      // This assumes the refresh endpoint uses the Authorization header
      const response = await this.authenticatedFetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
      });

      if (response.status === 404 || response.status === 405) {
        this.refreshSupported = false;
        return { success: true, refreshSupported: false };
      }

      if (response.status === 204) {
        this.refreshSupported = true;
        return { success: true, refreshSupported: true };
      }

      if (response.ok) {
        this.refreshSupported = true;
        const text = await response.text();
        let data: any = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            console.warn('Unexpected refresh response format:', parseError);
            data = {};
          }
        }

        if (data.access_token) {
          localStorage.setItem('access_token', data.access_token);
        }

        return {
          success: true,
          user: data.user,
          refreshSupported: true,
        };
      }

      this.refreshSupported = true;
      return { success: false, error: 'Token refresh failed', refreshSupported: true };
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        refreshSupported: this.refreshSupported !== false,
      };
    }
  }
}

export const secureAuthService = SecureAuthService.getInstance();
