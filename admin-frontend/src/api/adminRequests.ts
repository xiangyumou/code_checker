import { apiClient } from '../lib/communication';
import { message } from 'antd';
import type { AnalysisRequest, RequestStatus, RequestSummary } from '../../shared/src/types/index';

// Type for batch action payload
interface BatchActionPayload {
  action: 'delete' | 'retry';
  request_ids: number[];
}

// Type for batch action response (adjust based on actual backend response)
interface BatchActionResponse {
  message: string;
  results: {
    success: number[];
    failed: { id: number; reason: string }[];
  };
}

/**
 * Fetches analysis requests for the admin panel.
 * Supports pagination and status filtering.
 * @param status - Optional status to filter by.
 * @param skip - Optional number of records to skip.
 * @param limit - Optional maximum number of records to return.
 * @returns A promise resolving to an array of requests.
 */
export const getAdminAnalysisRequests = async (
    status?: RequestStatus,
    skip: number = 0,
    limit: number = 50 // Default limit for admin panel
): Promise<RequestSummary[]> => { // Updated to return RequestSummary array
  try {
    const params: { skip: number; limit: number; status?: RequestStatus } = { skip, limit };
    if (status) {
      params.status = status;
    }
    // Use the admin-specific endpoint
    return await apiClient.get<RequestSummary[]>('/admin/requests/', { params });
  } catch (error: any) {
    console.error("Error fetching admin analysis requests:", error);
    const detail = error.response?.data?.detail || 'Failed to fetch requests.';
    message.error(detail);
    throw new Error(detail);
  }
};

/**
 * Fetches details for a specific analysis request (admin view).
 * Includes all versions and potentially raw responses.
 * @param requestId - The ID of the request to fetch.
 * @returns A promise resolving to the detailed request data.
 */
export const getAdminAnalysisRequestDetails = async (requestId: number): Promise<AnalysisRequest> => {
  try {
    // Use the admin-specific endpoint
    return await apiClient.get<AnalysisRequest>(`/admin/requests/${requestId}`);
  } catch (error: any) {
    console.error(`Error fetching admin details for request ${requestId}:`, error);
    const detail = error.response?.data?.detail || 'Failed to fetch request details.';
    message.error(detail);
    throw new Error(detail);
  }
};

/**
 * Deletes a specific analysis request.
 * @param requestId - The ID of the request to delete.
 * @returns A promise resolving to the deleted request data (or success indicator).
 */
export const deleteAdminAnalysisRequest = async (requestId: number): Promise<AnalysisRequest> => { // Adjust return type if needed
  try {
    const result = await apiClient.delete<AnalysisRequest>(`/admin/requests/${requestId}`);
    message.success(`Request #${requestId} deleted successfully.`);
    return result;
  } catch (error: any) {
    console.error(`Error deleting request ${requestId}:`, error);
    const detail = error.response?.data?.detail || 'Failed to delete request.';
    message.error(detail);
    throw new Error(detail);
  }
};

/**
 * Retries a specific analysis request.
 * @param requestId - The ID of the request to retry.
 * @returns A promise resolving to the updated request data (status should be Queued).
 */
export const retryAdminAnalysisRequest = async (requestId: number): Promise<AnalysisRequest> => {
  try {
    const result = await apiClient.post<AnalysisRequest>(`/admin/requests/${requestId}/retry`);
    message.success(`Request #${requestId} queued for retry.`);
    return result;
  } catch (error: any) {
    console.error(`Error retrying request ${requestId}:`, error);
    const detail = error.response?.data?.detail || 'Failed to retry request.';
    message.error(detail);
    throw new Error(detail);
  }
};

/**
 * Performs a batch action (delete or retry) on multiple requests.
 * @param payload - The batch action details (action type and request IDs).
 * @returns A promise resolving to the batch action response.
 */
export const batchAdminRequestAction = async (payload: BatchActionPayload): Promise<BatchActionResponse> => {
    try {
        const result = await apiClient.post<BatchActionResponse>('/admin/requests/batch', payload);
        message.success(result.message || 'Batch action processed.');
        // Optionally show details about failures
        if (result.results?.failed?.length > 0) {
            message.warning(`${result.results.failed.length} requests failed during batch operation. Check console for details.`);
            console.warn("Batch action failures:", result.results.failed);
        }
        return result;
    } catch (error: any) {
        console.error("Error performing batch action:", error);
        const detail = error.response?.data?.detail || 'Batch action failed.';
        message.error(detail);
        throw new Error(detail);
    }
};