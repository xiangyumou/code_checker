/**
 * Centralized API client core functionality
 * Eliminates duplication between user and admin API clients
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { message } from 'antd';

interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  withAuth?: boolean;
  authTokenKey?: string;
  onAuthFailure?: () => void;
}

interface ApiErrorData {
  detail?: string | Array<{ loc: string[]; msg: string }>;
}

export class CentralizedApiClient {
  private instance: AxiosInstance;
  private config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL || '/api/v1',
      timeout: config.timeout || 10000,
      withAuth: config.withAuth || false,
      authTokenKey: config.authTokenKey || 'admin_token',
      onAuthFailure: config.onAuthFailure || (() => {}),
    };

    this.instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        if (this.config.withAuth) {
          const token = localStorage.getItem(this.config.authTokenKey);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const errorMessage = this.handleError(error);
        
        // Don't show message for 401 errors as they trigger redirects
        if (error.response?.status !== 401) {
          message.error(errorMessage);
        }
        
        return Promise.reject(error);
      }
    );
  }

  private handleError(error: AxiosError): string {
    let errorMessage = 'An unexpected error occurred.';

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as ApiErrorData;

      // Handle 401 Unauthorized
      if (status === 401) {
        errorMessage = 'Authentication failed or expired. Please log in again.';
        if (this.config.withAuth) {
          localStorage.removeItem(this.config.authTokenKey);
          this.config.onAuthFailure();
        }
        return errorMessage;
      }

      // Extract detail message if available
      if (data && data.detail) {
        if (status === 422 && Array.isArray(data.detail)) {
          errorMessage = `Validation Error: ${data.detail
            .map((err) => `${err.loc.join('.')} - ${err.msg}`)
            .join(', ')}`;
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else {
          errorMessage = `Server Error ${status}: An unspecified error occurred.`;
        }
      } else {
        errorMessage = `Server Error: ${status}`;
      }

      // Specific messages for common statuses
      switch (status) {
        case 403:
          errorMessage = 'Forbidden. You do not have permission to perform this action.';
          break;
        case 404:
          errorMessage = 'Resource not found.';
          break;
        default:
          if (status >= 500) {
            errorMessage = `Server Error (${status}): Please try again later or contact support.`;
          }
      }
    } else if (error.request) {
      errorMessage = 'Network Error: Could not connect to the server. Please check your connection.';
    } else {
      errorMessage = `Request Error: ${error.message}`;
    }

    return errorMessage;
  }

  // HTTP Methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  // Form data upload
  async upload<T>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post<T>(url, formData, {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Update auth token
  updateAuthToken(token: string | null) {
    if (token) {
      localStorage.setItem(this.config.authTokenKey, token);
    } else {
      localStorage.removeItem(this.config.authTokenKey);
    }
  }

  // Get raw axios instance for advanced usage
  getRawInstance(): AxiosInstance {
    return this.instance;
  }
}