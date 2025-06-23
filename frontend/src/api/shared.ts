// Shared API functions used by both user and admin features
import type { AnalysisRequest } from '../types/index';

// Since this function needs to work with both user and admin contexts,
// we'll accept the apiClient as a parameter
interface ApiClient {
  post<T>(url: string, data?: any): Promise<T>;
}

/**
 * Triggers the regeneration of analysis for a specific request.
 * @param apiClient - The API client instance (from either user or admin)
 * @param requestId - The ID of the request to regenerate.
 * @returns A promise resolving to the updated request data (AnalysisRequest).
 */
export const regenerateAnalysis = async (apiClient: ApiClient, requestId: number): Promise<AnalysisRequest> => {
  try {
    return await apiClient.post<AnalysisRequest>(`/requests/${requestId}/regenerate`);
  } catch (error) {
    console.error(`Error regenerating analysis for request ${requestId}:`, error);
    throw error;
  }
};