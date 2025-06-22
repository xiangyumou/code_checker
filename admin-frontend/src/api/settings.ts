import axiosInstance from './axiosInstance'; // Use configured instance with interceptors
import { message } from 'antd';
import { AppSettings } from '../types'; // Import the specific settings type

// Type for the settings object (keys are strings, values can be any type initially)
// export type SettingsData = Record<string, any>; // Replaced by AppSettings

/**
 * Fetches all current settings.
 * Requires admin authentication (handled by axiosInstance interceptor).
 * @returns A promise resolving to the settings data object.
 */
export const getSettings = async (): Promise<AppSettings> => {
  try {
    // Expect the response data to conform to the AppSettings interface
    const response = await axiosInstance.get<AppSettings>('/admin/settings/');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching settings:", error);
    const detail = error.response?.data?.detail || 'Failed to fetch settings.';
    message.error(detail);
    throw new Error(detail);
  }
};

/**
 * Updates multiple settings.
 * Requires admin authentication.
 * @param settingsToUpdate - An object containing the settings keys and their new values.
 * @returns A promise resolving to the updated settings data object (potentially masked).
 */
export const updateSettings = async (settingsToUpdate: Partial<AppSettings>): Promise<AppSettings> => {
  try {
    // The backend endpoint expects the data in a specific format: {"settings": {...}}
    // Use Partial<AppSettings> for the input as we might only update some settings
    const payload = { settings: settingsToUpdate };
    // Expect the response data (updated settings) to conform to AppSettings
    const response = await axiosInstance.put<AppSettings>('/admin/settings/', payload);
    message.success('Settings updated successfully!');
    return response.data;
  } catch (error: any) {
    console.error("Error updating settings:", error);
    const detail = error.response?.data?.detail || 'Failed to update settings.';
    message.error(detail);
    throw new Error(detail);
  }
};