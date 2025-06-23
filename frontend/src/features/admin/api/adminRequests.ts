import { apiClient } from '../lib/communication';
import { message } from 'antd';
import type { AnalysisRequest, RequestStatus, RequestSummary } from '../../../types/index';
import i18n from '../../../i18n';

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
  } catch (error: unknown) {
    // Error fetching admin analysis requests
    const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || i18n.t('adminRequests.fetchError') : i18n.t('adminRequests.fetchError');
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
  } catch (error: unknown) {
    // Error fetching admin details for request
    const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || i18n.t('adminRequests.fetchDetailsError') : i18n.t('adminRequests.fetchDetailsError');
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
    message.success(i18n.t('adminRequests.deleteSuccess', { id: requestId }));
    return result;
  } catch (error: unknown) {
    // Error deleting request
    const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || i18n.t('adminRequests.deleteError') : i18n.t('adminRequests.deleteError');
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
    message.success(i18n.t('adminRequests.retrySuccess', { id: requestId }));
    return result;
  } catch (error: unknown) {
    // Error retrying request
    const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || i18n.t('adminRequests.retryError') : i18n.t('adminRequests.retryError');
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
        message.success(result.message || i18n.t('adminRequests.batchActionSuccess'));
        // Optionally show details about failures
        if (result.results?.failed?.length > 0) {
            message.warning(i18n.t('adminRequests.batchActionWarning', { count: result.results.failed.length }));
            // Batch action failures logged
        }
        return result;
    } catch (error: unknown) {
        // Error performing batch action
        const detail = error instanceof Error && 'response' in error ? (error as any).response?.data?.detail || i18n.t('adminRequests.batchActionError') : i18n.t('adminRequests.batchActionError');
        message.error(detail);
        throw new Error(detail);
    }
};