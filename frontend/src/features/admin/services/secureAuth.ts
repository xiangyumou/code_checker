/**
 * Secure authentication service using httpOnly cookies instead of localStorage
 * This prevents XSS attacks from accessing authentication tokens
 */

interface AuthResponse {
  success: boolean;
  user?: any;
  error?: string;
}

class SecureAuthService {
  private static instance: SecureAuthService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = '/api/v1'; // Adjust based on your API base URL
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
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies in requests
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Token is automatically set as httpOnly cookie by backend
        return { success: true, user: data.user };
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
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Check if user is authenticated by trying to fetch profile
   */
  async checkAuth(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        credentials: 'include',
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
    return fetch(url, {
      ...options,
      credentials: 'include', // Always include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * Refresh token if needed (handled automatically by httpOnly cookies)
   */
  async refreshToken(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, user: data.user };
      } else {
        return { success: false, error: 'Token refresh failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }
}

export const secureAuthService = SecureAuthService.getInstance();