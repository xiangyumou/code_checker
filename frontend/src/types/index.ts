// Define shared types used across the frontend application

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

// AnalysisVersion interface is no longer needed

// Represents a full analysis request object, now including analysis results directly
export interface AnalysisRequest {
  id: number;
  status: RequestStatus;
  created_at: string; // ISO string format
  updated_at: string; // ISO string format
  user_prompt?: string | null;
  image_references?: string[] | null; // Stores relative paths to images
  images_base64?: string[] | null; // List of Base64 encoded image strings from backend
  error_message?: string | null;

  // Analysis Results (added directly to the request)
  gpt_raw_response?: string | null; // Raw JSON response from GPT
  // Removed: organized_problem_json, modified_code, modification_analysis_json
  // Frontend will now parse gpt_raw_response to get this information
  is_success: boolean; // Indicates if the analysis was successful
}
// Represents a summary of an analysis request, used for lists
export interface RequestSummary {
  id: number;
  status: RequestStatus;
  created_at: string; // ISO string format
  updated_at: string; // ISO string format
  filename?: string | null; // Optional: filename if available from submission
  error_message?: string | null;
}

// Type for the data submitted via the form
export interface SubmissionFormData {
    user_prompt?: string | null;
    // images_base64?: string[] | null; // Removed: No longer sending base64
    images?: File[] | null; // Added: Expecting an array of File objects for FormData
}

// Type for WebSocket status update messages
export interface WebSocketStatusUpdate {
    type: 'status_update';
    request_id: number;
    status: RequestStatus;
    error_message?: string | null;
}

// Add other shared types as needed

// Admin types
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

// Log types
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

export interface Log {
  id: number;
  timestamp: string; // ISO string format
  level: LogLevel;
  message: string;
  source?: string | null;
}

export interface PaginatedLogs {
  items: Log[];
  total: number;
}

export interface LogQueryParams {
  skip?: number;
  limit?: number;
  level?: LogLevel;
  start_date?: string; // ISO string format
  end_date?: string; // ISO string format
  search?: string;
}