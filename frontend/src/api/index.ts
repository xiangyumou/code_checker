import { userApiClient } from './centralized';

export { adminApiClient, updateAuthToken, useWebSocket } from './centralized';
export { RequestService, AuthService, SettingsService } from './centralized';
export { userApiClient };

// Backward compatibility export for modules that previously imported the default axios instance.
// The centralized client returns parsed response data and automatically handles base URL configuration.
export const api = userApiClient;
