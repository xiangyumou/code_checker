/**
 * Centralized request service
 * Handles both user and admin request operations
 */

import { userApiClient, adminApiClient } from '../clients';
import type { RequestSummary, AnalysisRequest, RequestStatus } from '../../../types/index';

export class RequestService {
  // User request operations (no auth required)
  static async getUserRequests(
    status?: RequestStatus,
    skip: number = 0,
    limit: number = 100
  ): Promise<RequestSummary[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());

    return userApiClient.get<RequestSummary[]>(`/requests?${params.toString()}`);
  }

  static async getUserRequestDetails(requestId: number): Promise<AnalysisRequest> {
    return userApiClient.get<AnalysisRequest>(`/requests/${requestId}`);
  }

  static async createUserRequest(formData: FormData): Promise<AnalysisRequest> {
    return userApiClient.upload<AnalysisRequest>('/requests', formData);
  }

  static async regenerateUserRequest(requestId: number): Promise<AnalysisRequest> {
    return userApiClient.post<AnalysisRequest>(`/requests/${requestId}/regenerate`);
  }

  // Admin request operations (auth required)
  static async getAdminRequests(
    status?: RequestStatus,
    skip: number = 0,
    limit: number = 100
  ): Promise<RequestSummary[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());

    return adminApiClient.get<RequestSummary[]>(`/admin/requests?${params.toString()}`);
  }

  static async getAdminRequestDetails(requestId: number): Promise<AnalysisRequest> {
    return adminApiClient.get<AnalysisRequest>(`/admin/requests/${requestId}`);
  }

  static async deleteAdminRequest(requestId: number): Promise<void> {
    return adminApiClient.delete<void>(`/admin/requests/${requestId}`);
  }
}