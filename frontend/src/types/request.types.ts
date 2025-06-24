// Request-related types

export type RequestStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface ModificationAnalysisItem {
  original_snippet: string;
  modified_snippet: string;
  explanation: string;
}

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
  is_success: boolean; // Indicates if the analysis was successful
}

export interface RequestSummary {
  id: number;
  status: RequestStatus;
  created_at: string; // ISO string format
  updated_at: string; // ISO string format
  user_prompt?: string | null;
  error_message?: string | null;
  is_success: boolean;
}