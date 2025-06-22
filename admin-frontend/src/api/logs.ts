import { apiClient } from '../lib/communication';
import { message } from 'antd';

/**
 * Fetches the list of available log files.
 * Requires admin authentication.
 * @returns A promise resolving to an array of log filenames.
 */
export const listLogFiles = async (): Promise<string[]> => {
  try {
    return await apiClient.get<string[]>('/admin/logs/');
  } catch (error: any) {
    console.error("Error listing log files:", error);
    const detail = error.response?.data?.detail || 'Failed to list log files.';
    message.error(detail);
    throw new Error(detail);
  }
};

/**
 * Fetches the content of a specific log file.
 * Requires admin authentication.
 * @param filename - The name of the log file (e.g., "app.log").
 * @param tail - Optional number of lines to fetch from the end.
 * @param head - Optional number of lines to fetch from the beginning.
 * @returns A promise resolving to the log content as a string.
 */
export const getLogContent = async (
    filename: string,
    tail?: number,
    head?: number
): Promise<string> => {
  try {
    const params: { tail?: number; head?: number } = {};
    if (tail) params.tail = tail;
    if (head) params.head = head; // Note: API currently supports either tail or head, not both

    // Expect plain text response
    return await apiClient.get<string>(`/admin/logs/${filename}`, {
        params,
        responseType: 'text', // Important: Ensure Axios treats response as text
        transformResponse: [(data) => data], // Prevent Axios from trying to parse JSON
    });
  } catch (error: any) {
    console.error(`Error fetching log content for ${filename}:`, error);
    // Try to parse potential JSON error detail from text response if status indicates error
    let detail = `Failed to fetch log file '${filename}'.`;
    if (error.response?.data && typeof error.response.data === 'string') {
        try {
            const errorJson = JSON.parse(error.response.data);
            detail = errorJson.detail || detail;
        } catch (parseError) {
            // Ignore if response is not JSON
        }
    } else if (error.response?.data?.detail) {
         detail = error.response.data.detail;
    }
    message.error(detail);
    throw new Error(detail);
  }
};