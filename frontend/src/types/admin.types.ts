// Admin-related types

export interface AdminUser {
  id: number;
  username: string;
  is_active: boolean;
}

export interface AppSettings {
  openai_api_key?: string;
  openai_model?: string;
  openai_base_url?: string;
  system_prompt?: string;
  max_concurrent_analysis_tasks?: number;
  openai_parallel_requests_per_prompt?: number;
  openai_total_attempts_per_prompt?: number;
  request_timeout_seconds?: number;
  max_analysis_versions?: number;
  log_level?: string;
  [key: string]: any; // For additional dynamic settings
}