import axios, { AxiosError } from 'axios'; // Import AxiosError
import { message } from 'antd';

// Base URL for the API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'; // Use env var, fallback to relative path

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // Slightly longer timeout for admin actions potentially
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token'); // Retrieve token from localStorage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Handle case where token is missing but request requires auth
      // This shouldn't happen if ProtectedRoute works correctly, but as a safeguard:
      // Auth token missing for API request.
      // Optionally cancel the request or redirect to login
      // return Promise.reject(new Error('Auth token missing'));
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for global error handling (e.g., 401 Unauthorized)
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // API Error

    let errorMessage = 'An unexpected error occurred.';
    let shouldReject = true; // Flag to control if we reject the promise

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { detail?: string | Array<{ loc: string[]; msg: string }> }; // Type assertion

      // Handle 401 Unauthorized specifically: redirect to login
      if (status === 401) {
        errorMessage = 'Authentication failed or expired. Please log in again.';
        localStorage.removeItem('admin_token'); // Clear invalid token
        // Use window.location to redirect outside of React Router context if needed
        if (window.location.pathname !== '/login') { // Avoid redirect loop if already on login
             window.location.href = '/login';
        }
        shouldReject = false; // Don't reject, let the redirect handle it
      }
      // Extract detail message for other errors if available
      else if (data && data.detail) {
          // Handle validation errors specifically (status 422)
          if (status === 422 && Array.isArray(data.detail)) {
               errorMessage = `Validation Error: ${data.detail.map((err) => `${err.loc.join('.')} - ${err.msg}`).join(', ')}`;
          } else if (typeof data.detail === 'string') {
              errorMessage = data.detail;
          } else {
              errorMessage = `Server Error ${status}: An unspecified error occurred.`;
          }
      } else {
          errorMessage = `Server Error: ${status}`;
      }

      // Specific messages for other common statuses
      if (status === 403) {
        errorMessage = 'Forbidden. You do not have permission to perform this action.';
      } else if (status === 404) {
        errorMessage = 'Resource not found.';
      } else if (status >= 500) {
          errorMessage = `Server Error (${status}): Please try again later or contact support.`;
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'Network Error: Could not connect to the server. Please check your connection.';
    } else {
      // Something happened in setting up the request that triggered an Error
      errorMessage = `Request Error: ${error.message}`;
    }

    // Display the error message using Ant Design (unless it was a 401 redirect)
    if (shouldReject) {
        message.error(errorMessage);
    }

    // Reject the promise if the error wasn't handled by a redirect (e.g., 401)
    if (shouldReject) {
        return Promise.reject(error);
    } else {
        // For handled errors like 401, return a resolved promise to prevent uncaught errors
        return Promise.resolve({ data: null, status: error.response?.status });
    }
  }
);

export default axiosInstance;