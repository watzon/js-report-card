/**
 * Custom error class for download-related errors
 */
export class DownloaderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sourceType: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DownloaderError';
  }
}

// Common error codes
export const DownloaderErrorCodes = {
  DOWNLOADER_NOT_FOUND: 'DOWNLOADER_NOT_FOUND',
  INVALID_SOURCE: 'INVALID_SOURCE',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  CLEANUP_FAILED: 'CLEANUP_FAILED',
  AUTH_FAILED: 'AUTH_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_PATH: 'INVALID_PATH',
  GIT_CLONE_FAILED: 'GIT_CLONE_FAILED',
  ZIP_EXTRACT_FAILED: 'ZIP_EXTRACT_FAILED',
  NPM_DOWNLOAD_FAILED: 'NPM_DOWNLOAD_FAILED',
  LOCAL_COPY_FAILED: 'LOCAL_COPY_FAILED',
} as const;

export type DownloaderErrorCode = keyof typeof DownloaderErrorCodes;

export class AnalyzerError extends Error {
  constructor(
    message: string,
    public readonly analyzerId: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AnalyzerError';
  }
}

export const AnalyzerErrorCodes = {
  DUPLICATE_ANALYZER: 'DUPLICATE_ANALYZER',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  INVALID_CONFIG: 'INVALID_CONFIG',
  ANALYZER_NOT_FOUND: 'ANALYZER_NOT_FOUND',
} as const;

export type AnalyzerErrorCode = keyof typeof AnalyzerErrorCodes;