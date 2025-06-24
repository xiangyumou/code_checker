import { userApiClient as apiClient } from '@/api/centralized';
// Import specific types from the shared library
import type { RequestStatus, AnalysisRequest, SubmissionFormData, RequestSummary } from '../../../types/index';

// Use SubmissionFormData for the payload type
type CreateRequestPayload = SubmissionFormData;

// Use AnalysisRequest for the return type
type ApiRequest = AnalysisRequest;


// Define the structure for the list response (if backend wraps list)
// interface ApiRequestListResponse {
//   requests: ApiRequest[];
//   total: number;
// }

/**
 * Creates a new analysis request.
 * @param payload - The data for the new request.
 * @returns A promise resolving to the created request data (AnalysisRequest).
 */
export const createAnalysisRequest = async (payload: CreateRequestPayload): Promise<AnalysisRequest> => {
  try {
    // Create a FormData object
    const formData = new FormData();

    // Append user_prompt if it's not null or undefined. Allow empty string "".
    if (payload.user_prompt !== null && payload.user_prompt !== undefined) {
      formData.append('user_prompt', payload.user_prompt);
    }
    // Alternatively, if backend expects the field even if empty:
    // formData.append('user_prompt', payload.user_prompt || '');

    // Append images if they exist and are File objects
    if (payload.images && payload.images.length > 0) {
      payload.images.forEach((imageFile) => {
        // Now we expect imageFile to always be a File object due to changes in SubmissionForm
        if (imageFile instanceof File) {
          formData.append('images', imageFile, imageFile.name);
        } else {
          // This case should ideally not happen anymore if SubmissionForm sends File[]
          // Skipping unexpected non-File item in images array
        }
      });
    }

    // Send the FormData object. Axios will automatically set Content-Type to multipart/form-data.
    return await apiClient.post<AnalysisRequest>('/requests/', formData);
  } catch (error) {
    // Error creating analysis request
    // Re-throw or handle error as needed (e.g., show notification)
    throw error;
  }
};

/**
 * Fetches a list of analysis requests.
 * @param status - Optional status to filter by.
 * @param skip - Optional number of records to skip (for pagination).
 * @param limit - Optional maximum number of records to return.
 * @returns A promise resolving to an array of requests (AnalysisRequest[]).
 */
export const getAnalysisRequests = async (
    status?: RequestStatus,
    skip: number = 0,
    limit: number = 100
): Promise<RequestSummary[]> => { // Use RequestSummary type for list view
  try {
    const params: { skip: number; limit: number; status?: RequestStatus } = { skip, limit };
    if (status) {
      params.status = status;
    }
    return await apiClient.get<RequestSummary[]>('/requests/', { params });
  } catch (error) {
    // Error fetching analysis requests
    throw error;
  }
};

/**
 * Fetches details for a specific analysis request.
 * @param requestId - The ID of the request to fetch.
 * @returns A promise resolving to the request data (AnalysisRequest).
 */
export const getAnalysisRequestDetails = async (requestId: number): Promise<AnalysisRequest> => {
  try {
    return await apiClient.get<AnalysisRequest>(`/requests/${requestId}`);
  } catch (error) {
    // Error fetching details for request
    throw error;
  }
};

/**
 * Triggers the regeneration of analysis for a specific request.
 * @param requestId - The ID of the request to regenerate.
 * @returns A promise resolving to the updated request data (AnalysisRequest).
 */
export const regenerateAnalysis = async (requestId: number): Promise<AnalysisRequest> => {
  try {
    return await apiClient.post<AnalysisRequest>(`/requests/${requestId}/regenerate`);
  } catch (error) {
    // Error regenerating analysis for request
    throw error;
  }
};