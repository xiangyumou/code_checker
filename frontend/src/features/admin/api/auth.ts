import axios from 'axios'; // Use raw axios for login as it might not need interceptors initially
import { message } from 'antd'; // For showing error messages

// Define the structure for the login response (matches backend schema Token)
interface LoginResponse {
  access_token: string;
  token_type: string;
}

// Define the structure for login payload
interface LoginPayload {
  username: string;
  password?: string; // Password might be optional if using other auth methods later
}

// Base URL for the API used by adminLogin (raw axios) - Adjust if needed
const ADMIN_LOGIN_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Performs admin login.
 * Note: Uses raw axios to avoid potential token interceptors if instance is shared.
 * Sends data as 'application/x-www-form-urlencoded' as expected by FastAPI's OAuth2PasswordRequestForm.
 * @param payload - The login credentials.
 * @returns A promise resolving to the login response containing the token.
 */
export const adminLogin = async (payload: LoginPayload): Promise<LoginResponse> => {
  const formData = new URLSearchParams();
  formData.append('username', payload.username);
  if (payload.password) {
    formData.append('password', payload.password);
  }
  // Grant type is often required by OAuth2 flows, but FastAPI's default form might not need it explicitly here.
  // formData.append('grant_type', 'password');
  // formData.append('scope', ''); // Add scope if needed
  // formData.append('client_id', ''); // Add client_id if needed
  // formData.append('client_secret', ''); // Add client_secret if needed

  try {
    const response = await axios.post<LoginResponse>(
      `${ADMIN_LOGIN_API_BASE_URL}/login/access-token`, // Use specific base URL for raw axios call
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  } catch (error: unknown) {
    console.error("Admin login error:", error);
    const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || 'Login failed. Please check credentials.' : 'Login failed. Please check credentials.';
    message.error(detail); // Show error message to user
    throw new Error(detail);
  }
};
import { apiClient } from '../lib/communication';
import type { AdminUser } from '../../../types/index';

// Define the structure for the profile update payload
interface UpdateProfilePayload {
  username?: string;
  password?: string;
}

/**
 * Fetches the profile of the currently authenticated admin user.
 * Uses the /login/test-token endpoint which returns the user object on success.
 * @returns A promise resolving to the AdminUser object.
 */
export const getMyProfile = async (): Promise<AdminUser> => {
  try {
    // This endpoint verifies the token and returns the user if valid
    // Use relative path - axiosInstance handles the base URL
    return await apiClient.post<AdminUser>('/login/test-token');
  } catch (error: unknown) {
    console.error("Error fetching user profile:", error);
    const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || 'Failed to fetch user profile. Session might be invalid.' : 'Failed to fetch user profile. Session might be invalid.';
    // Avoid showing generic error if it's just an auth issue handled elsewhere (e.g., redirect)
    if (error instanceof Error && 'response' in error && (error as any).response?.status !== 401 && (error as any).response?.status !== 403) {
        message.error(detail);
    }
    throw new Error(detail); // Re-throw for potential handling by caller (e.g., logout)
  }
};

/**
 * Updates the profile (username and/or password) for the currently authenticated admin user.
 * @param payload - An object containing the optional new username and/or password.
 * @returns A promise resolving to the updated AdminUser object.
 */
export const updateMyProfile = async (payload: UpdateProfilePayload): Promise<AdminUser> => {
  // Filter out empty fields or unchanged username before sending
  const dataToSend: UpdateProfilePayload = {};
  if (payload.username) { // We assume the caller checks if username actually changed
      dataToSend.username = payload.username;
  }
  // Only include password if it's non-empty. Backend handles hashing.
  // Ensure password is not just whitespace
  if (payload.password && payload.password.trim()) {
      dataToSend.password = payload.password.trim();
  }

  // It's better practice for the calling component to check if there are actual changes
  // before calling the API, but we add a safeguard here.
  if (Object.keys(dataToSend).length === 0) {
      message.info("No changes detected to update profile.");
      // Returning the profile might be confusing. Throwing an error might be too harsh.
      // Let's return a resolved promise with a specific status or null.
      // Or perhaps the backend handles this? The backend currently returns the user if no data.
      // Let's rely on the backend check for now, or the frontend check.
      // For robustness, let's prevent the API call if nothing to send.
      return Promise.reject(new Error("No changes to submit.")); // Or return Promise.resolve(null);
  }

  try {
    // Use relative path - axiosInstance handles the base URL
    const result = await apiClient.put<AdminUser>('/admin/profile/me', dataToSend);
    message.success('Profile updated successfully!');
    return result;
  } catch (error: unknown) {
    console.error("Error updating user profile:", error);
    // Handle specific 409 Conflict error for username explicitly
    if (error instanceof Error && 'response' in error && (error as any).response?.status === 409) {
         const detail = (error as any).response?.data?.detail || 'Username already exists. Please choose another.';
         message.error(detail);
         throw new Error(detail); // Re-throw specific error
    } else {
        // Handle other errors (e.g., validation, server errors)
        const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || 'Failed to update profile.' : 'Failed to update profile.';
        message.error(detail);
        throw new Error(detail); // Re-throw generic error
    }
  }
};