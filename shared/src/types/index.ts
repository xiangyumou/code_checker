// Unified types shared across frontend, admin-frontend, and backend communication

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

// Represents a summary of an analysis request, used for lists
export interface RequestSummary {
  id: number;
  status: RequestStatus;
  created_at: string; // ISO string format
  updated_at: string; // ISO string format
  filename?: string | null; // Optional: filename if available from submission
  error_message?: string | null;
}

// Represents a full analysis request object, including analysis results
export interface AnalysisRequest {
  id: number;
  status: RequestStatus;
  created_at: string; // ISO string format
  updated_at: string; // ISO string format
  user_prompt?: string | null;
  image_references?: string[] | null; // Stores relative paths to images (frontend)
  images_base64?: string[] | null; // List of Base64 encoded image strings (admin)
  error_message?: string | null;

  // Analysis Results
  gpt_raw_response?: string | null; // Raw JSON response from GPT
  is_success: boolean; // Indicates if the analysis was successful
}

// Type for the data submitted via the form
export interface SubmissionFormData {
  user_prompt?: string | null;
  images?: File[] | null; // For FormData submissions
}

// Type for WebSocket status update messages
export interface WebSocketStatusUpdate {
  type: 'status_update' | 'request_created' | 'request_updated' | 'request_deleted';
  request_id?: number;
  status?: RequestStatus;
  error_message?: string | null;
  payload?: any; // Additional data for different message types
}

// Admin-specific types
export interface AdminUser {
  id: number;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
}

export interface AppSettings {
  openai_api_key?: string; // Masked in response
  openai_base_url?: string | null;
  openai_model?: string;
  system_prompt?: string;
  max_concurrent_analysis_tasks?: number;
  parallel_openai_requests_per_prompt?: number;
  max_total_openai_attempts_per_prompt?: number;
  request_timeout_seconds?: number;
}

// API Configuration types
export interface ApiConfig {
  baseURL: string;
  timeout: number;
  authToken?: string;
  clientType: 'frontend' | 'admin';
}

// WebSocket Configuration types
export interface WebSocketConfig {
  url: string;
  clientId: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// Communication event types
export type CommunicationEventType = 
  | 'request_created'
  | 'request_updated' 
  | 'request_deleted'
  | 'status_update'
  | 'connection_established'
  | 'connection_lost'
  | 'error';

export interface CommunicationEvent {
  type: CommunicationEventType;
  payload?: any;
  timestamp?: string;
}