import { apiClient } from '../lib/communication';
import { message } from 'antd';
import i18n from 'i18next';
import type { AppSettings } from '../../../types/index';

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
    return await apiClient.get<AppSettings>('/admin/settings/');
  } catch (error: unknown) {
    console.error("Error fetching settings:", error);
    const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || i18n.t('admin.settings.fetchError') : i18n.t('admin.settings.fetchError');
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
    const result = await apiClient.put<AppSettings>('/admin/settings/', payload);
    message.success(i18n.t('admin.settings.updateSuccess'));
    return result;
  } catch (error: unknown) {
    console.error("Error updating settings:", error);
    const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || i18n.t('admin.settings.updateError') : i18n.t('admin.settings.updateError');
    message.error(detail);
    throw new Error(detail);
  }
};