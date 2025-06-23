import { apiClient } from '../lib/communication';
import { message } from 'antd';
import { PaginatedLogs, LogQueryParams } from '../../../types';

/**
 * Get paginated and filtered logs from the database
 */
export async function getLogs(params: LogQueryParams): Promise<PaginatedLogs> {
  try {
    const data = await apiClient.get<PaginatedLogs>('/admin/logs/', { params });
    return data;
  } catch (error) {
    message.error('Failed to fetch logs');
    throw error;
  }
}

/**
 * Clear all logs from the database
 */
export async function clearAllLogs(): Promise<void> {
  try {
    await apiClient.delete('/admin/logs/');
    message.success('All logs cleared successfully');
  } catch (error) {
    message.error('Failed to clear logs');
    throw error;
  }
}