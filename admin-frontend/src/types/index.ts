// Define shared types used across the admin frontend application
// Based on frontend/src/types/index.ts

// Matches the RequestStatus enum from the backend
export type RequestStatus = 'Queued' | 'Processing' | 'Completed' | 'Failed';

// Represents a single modification analysis item from the backend response
export interface ModificationAnalysisItem {
  original_snippet: string;
  modified_snippet: string;
  explanation: string;
}

// Represents the organized problem details from the backend response
export interface OrganizedProblem {
  title: string;
  time_limit: string; // e.g., "1s" or "N/A"
  memory_limit: string; // e.g., "256MB" or "N/A"
  description: string;
  input_format: string;
  output_format: string;
  input_sample: string;
  output_sample: string;
  notes: string; // "" or "N/A" if none
}

// Represents a summary of an analysis request for list views
export interface RequestSummary {
  id: number;
  status: RequestStatus;
  created_at: string; // ISO string format
  updated_at: string; // ISO string format
  filename: string | null; // Assuming filename might be null if not applicable
  error_message?: string | null;
}
// Represents a full analysis request object, now including analysis results directly
export interface AnalysisRequest {
  id: number;
  status: RequestStatus;
  created_at: string; // ISO string format
  updated_at: string; // ISO string format
  user_prompt?: string | null;
  images_base64?: string[] | null; // Reverted to support multiple images
  error_message?: string | null;

  // Analysis Results (added directly to the request)
  gpt_raw_response?: string | null; // Raw JSON response from GPT
  is_success: boolean; // Indicates if the analysis was successful
}

// Type for the data submitted via the form (if needed in admin)
// export interface SubmissionFormData {
//     user_prompt?: string | null;
//     images_base64?: string[] | null;
// }

// Type for WebSocket status update messages (if admin uses same format)
// export interface WebSocketStatusUpdate {
//     type: 'status_update';
//     request_id: number;
//     status: RequestStatus;
//     error_message?: string | null;
// }

// Type for Admin User (from backend schema)
export interface AdminUser {
    id: number;
    username: string;
    is_active: boolean;
    is_superuser: boolean;
}

// Type for App Settings (from backend schema)
export interface AppSettings {
    openai_api_key?: string; // Masked in response, only present if updated
    openai_base_url?: string | null;
    openai_model?: string;
    system_prompt?: string;
    max_concurrent_analysis_tasks?: number;
    parallel_openai_requests_per_prompt?: number; // Corrected key
    max_total_openai_attempts_per_prompt?: number; // Corrected key
    request_timeout_seconds?: number;
    // Add other settings keys as defined in backend/schemas/setting.py if needed
    // log_level?: string;
    // max_analysis_versions?: number;
}

// Add other admin-specific shared types as needed