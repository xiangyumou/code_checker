import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { CommunicationConfig } from '../config/index';

export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  authToken?: string;
  clientType: 'frontend' | 'admin';
  onUnauthorized?: () => void;
  showErrorMessages?: boolean;
}

export class UnifiedApiClient {
  private instance: AxiosInstance;
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      // Don't set default Content-Type - let axios handle it automatically
      // This allows FormData to set multipart/form-data and JSON to set application/json
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        // Add auth token if available
        if (this.config.authToken) {
          config.headers.Authorization = `Bearer ${this.config.authToken}`;
        }
        
        // Set Content-Type for JSON if not already set and not FormData
        if (!config.headers['Content-Type'] && !(config.data instanceof FormData)) {
          config.headers['Content-Type'] = 'application/json';
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleResponseError(error);
        return Promise.reject(error);
      }
    );
  }

  private handleResponseError(error: AxiosError): void {
    console.error('API Error:', error);

    let errorMessage = 'An unexpected error occurred.';

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      // Extract error message
      if (data?.detail) {
        if (status === 422 && Array.isArray(data.detail)) {
          errorMessage = `Validation Error: ${data.detail
            .map((err: any) => `${err.loc.join('.')} - ${err.msg}`)
            .join(', ')}`;
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        }
      } else {
        errorMessage = `Server Error: ${status}`;
      }

      // Handle specific status codes
      switch (status) {
        case 401:
          errorMessage = 'Unauthorized. Please log in again.';
          if (this.config.onUnauthorized) {
            this.config.onUnauthorized();
          }
          break;
        case 403:
          errorMessage = 'Forbidden. You do not have permission to access this resource.';
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

    // Show error message if enabled
    if (this.config.showErrorMessages !== false) {
      message.error(errorMessage);
    }
  }

  // Update auth token
  public setAuthToken(token: string | null): void {
    this.config.authToken = token || undefined;
  }

  // Get the underlying axios instance
  public getInstance(): AxiosInstance {
    return this.instance;
  }

  // Convenience methods
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.get(url, config);
    return response.data;
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post(url, data, config);
    return response.data;
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.put(url, data, config);
    return response.data;
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete(url, config);
    return response.data;
  }
}

// Factory function to create API client instances
export function createApiClient(
  communicationConfig: CommunicationConfig,
  options: {
    authToken?: string;
    onUnauthorized?: () => void;
    showErrorMessages?: boolean;
  } = {}
): UnifiedApiClient {
  return new UnifiedApiClient({
    baseURL: communicationConfig.api.baseURL,
    timeout: communicationConfig.api.timeout,
    clientType: communicationConfig.client.type,
    ...options,
  });
}

// Legacy compatibility - create simple axios instance
export function createLegacyAxiosInstance(config: ApiClientConfig): AxiosInstance {
  const client = new UnifiedApiClient(config);
  return client.getInstance();
}