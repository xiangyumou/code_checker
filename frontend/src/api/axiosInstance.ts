import axios, { AxiosError } from 'axios';
import { message } from 'antd'; // Import message component

// Determine the base URL for the API
// In development, Vite proxy handles '/api', so we use relative path.
// In production (Docker), Nginx will proxy '/api' to the backend service.
const API_BASE_URL = '/api/v1'; // Corresponds to the backend API prefix

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Set a reasonable timeout (e.g., 10 seconds)
  headers: {
    // Content-Type is removed, Axios will set it automatically
    // Add other default headers if needed
  },
});

// Optional: Add request interceptors (e.g., for adding auth tokens)
axiosInstance.interceptors.request.use(
  (config) => {
    // const token = localStorage.getItem('admin_token'); // Example for admin auth
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Optional: Add response interceptors (e.g., for global error handling)
axiosInstance.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return response;
  },
  (error: AxiosError) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    console.error('API Error:', error); // Log the full error

    let errorMessage = 'An unexpected error occurred.';

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const data = error.response.data as any; // Type assertion for data access

      // Extract detail message if available
      if (data && data.detail) {
          // Handle validation errors specifically (status 422)
          if (status === 422 && Array.isArray(data.detail)) {
               errorMessage = `Validation Error: ${data.detail.map((err: any) => `${err.loc.join('.')} - ${err.msg}`).join(', ')}`;
          } else if (typeof data.detail === 'string') {
              errorMessage = data.detail;
          } else {
              errorMessage = `Server Error ${status}: An unspecified error occurred.`;
          }
      } else {
          errorMessage = `Server Error: ${status}`;
      }

      // Specific handling for common statuses
      if (status === 401) {
        errorMessage = 'Unauthorized. Please log in again.';
        // Optionally redirect to login page
        // window.location.href = '/login';
      } else if (status === 403) {
        errorMessage = 'Forbidden. You do not have permission to access this resource.';
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

    // Display the error message using Ant Design
    message.error(errorMessage);

    // It's important to reject the promise so individual API call catch blocks can also handle it if needed
    return Promise.reject(error);
  }
);

export default axiosInstance;