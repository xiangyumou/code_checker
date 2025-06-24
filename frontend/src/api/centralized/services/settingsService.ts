/**
 * Centralized settings service
 */

import { adminApiClient, userApiClient } from '../clients';
import type { AppSettings, AdminUser } from '../../../types/index';

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
    openai_api_key: string;
    openai_base_url?: string;
    openai_model?: string;
    system_prompt?: string;
    max_concurrent_analysis_tasks?: number;
    parallel_openai_requests_per_prompt?: number;
    max_total_openai_attempts_per_prompt?: number;
    request_timeout_seconds?: number;
  }): Promise<AdminUser> {
    // Backend expects flat structure with specific field names
    const payload = {
      username: data.username,
      password: data.password,
      openai_api_key: data.openai_api_key,
      openai_base_url: data.openai_base_url,
      openai_model: data.openai_model || "gpt-4-turbo",
      system_prompt: data.system_prompt || "You are a helpful assistant.",
      max_concurrent_analysis_tasks: data.max_concurrent_analysis_tasks || 5,
      parallel_openai_requests_per_prompt: data.parallel_openai_requests_per_prompt || 5,
      max_total_openai_attempts_per_prompt: data.max_total_openai_attempts_per_prompt || 20,
      request_timeout_seconds: data.request_timeout_seconds || 500
    };
    
    return userApiClient.post<AdminUser>('/initialize', payload);
  }

  // Admin operations (auth required)
  static async getSettings(): Promise<AppSettings> {
    return adminApiClient.get<AppSettings>('/admin/settings');
  }

  static async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    // Backend expects PUT method with settings wrapped in { settings: {...} }
    // Also need to map frontend field names to backend field names
    const mappedSettings: any = {};
    
    if (settings.openai_api_key !== undefined) mappedSettings.openai_api_key = settings.openai_api_key;
    if (settings.openai_model !== undefined) mappedSettings.openai_model = settings.openai_model;
    if (settings.openai_base_url !== undefined) mappedSettings.openai_base_url = settings.openai_base_url;
    if (settings.system_prompt !== undefined) mappedSettings.system_prompt = settings.system_prompt;
    if (settings.max_concurrent_analysis_tasks !== undefined) mappedSettings.max_concurrent_analysis_tasks = settings.max_concurrent_analysis_tasks;
    if (settings.openai_parallel_requests_per_prompt !== undefined) mappedSettings.parallel_openai_requests_per_prompt = settings.openai_parallel_requests_per_prompt;
    if (settings.openai_total_attempts_per_prompt !== undefined) mappedSettings.max_total_openai_attempts_per_prompt = settings.openai_total_attempts_per_prompt;
    if (settings.request_timeout_seconds !== undefined) mappedSettings.request_timeout_seconds = settings.request_timeout_seconds;
    if (settings.log_level !== undefined) mappedSettings.log_level = settings.log_level;
    
    return adminApiClient.put<AppSettings>('/admin/settings', {
      settings: mappedSettings
    });
  }
}