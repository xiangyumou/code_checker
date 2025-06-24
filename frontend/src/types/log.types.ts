// Log-related types

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

export interface Log {
  id: number;
  timestamp: string; // ISO string format
  level: LogLevel;
  message: string;
  source?: string | null;
}

export interface PaginatedLogs {
  items: Log[];
  total: number;
}

export interface LogQueryParams {
  skip?: number;
  limit?: number;
  level?: LogLevel;
  start_date?: string; // ISO string format
  end_date?: string; // ISO string format
  search?: string;
}