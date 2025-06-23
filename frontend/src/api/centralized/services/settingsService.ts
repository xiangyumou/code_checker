/**
 * Centralized settings service
 */

import { adminApiClient, userApiClient } from '../clients';
import type { AppSettings } from '../../../types/index';

interface InitializationStatus {
  initialized: boolean;
}

export class SettingsService {
  // User operations (no auth)
  static async getInitializationStatus(): Promise<InitializationStatus> {
    return userApiClient.get<InitializationStatus>('/initialize/status');
  }

  static async initialize(data: {
    username: string;
    password: string;
    settings: Partial<AppSettings>;
  }): Promise<{ success: boolean; message: string }> {
    return userApiClient.post('/initialize', data);
  }

  // Admin operations (auth required)
  static async getSettings(): Promise<AppSettings> {
    return adminApiClient.get<AppSettings>('/admin/settings');
  }

  static async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return adminApiClient.patch<AppSettings>('/admin/settings', settings);
  }
}