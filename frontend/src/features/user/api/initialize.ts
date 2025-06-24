import { userApiClient as apiClient } from '@/api/centralized';

// Type for the initialization status response
interface InitializationStatus {
  initialized: boolean;
}

// Type for the data submitted during initialization
// Matches backend schema InitializeData (excluding password confirmation if added)
interface InitializePayload {
  username: string;
  password?: string; // Password might be optional if only checking status
  openai_api_key?: string;
  openai_base_url?: string | null;
  openai_model?: string | null;
}

/**
 * Checks the initialization status of the application.
 * @returns A promise resolving to the initialization status object.
 */
export const checkInitializationStatus = async (): Promise<InitializationStatus> => {
  try {
    return await apiClient.get<InitializationStatus>('/initialize/status');
  } catch (error) {
    console.error("Error checking initialization status:", error);
    // Assume not initialized or error state? For safety, maybe treat error as needing initialization check again.
    // Or throw error to be handled by caller. Let's throw for now.
    throw error;
  }
};

/**
 * Submits the initial configuration data.
 * @param payload - The initialization data including admin credentials and OpenAI settings.
 * @returns A promise resolving to the created admin user data (or relevant success indicator).
 */
export const submitInitialization = async (payload: InitializePayload): Promise<any> => { // Use specific type for response later if needed
  try {
    // Ensure password is provided when submitting
    if (!payload.password) {
        throw new Error("Password is required for initialization.");
    }
    return await apiClient.post('/initialize/', payload);
  } catch (error) {
    console.error("Error submitting initialization:", error);
    // Extract backend error message if available
    const detail = (error as any).response?.data?.detail || 'Initialization failed.';
    throw new Error(detail); // Throw a new error with a potentially more user-friendly message
  }
};