/**
 * Claude Code Router (CCR) Types
 *
 * Types for CCR integration, status detection, and configuration.
 */

/**
 * CCRStatus - Status of Claude Code Router installation and server
 */
export interface CCRStatus {
  /** Whether CCR CLI is installed and accessible */
  installed: boolean;
  /** Whether CCR server is currently running */
  running: boolean;
  /** Port the CCR server is listening on (if running) */
  port?: number;
  /** API endpoint URL (e.g., http://127.0.0.1:13456) */
  apiEndpoint?: string;
  /** Version of CCR if detected */
  version?: string;
  /** Error message if status check failed */
  error?: string;
}

/**
 * CCRConfig - Parsed CCR configuration from ~/.claude-code-router/config.json
 */
export interface CCRConfig {
  /** Host to bind the server to */
  HOST?: string;
  /** Port to bind the server to */
  PORT?: number;
  /** API key for authentication */
  APIKEY?: string;
  /** API timeout in milliseconds */
  API_TIMEOUT_MS?: string | number;
  /** Whether logging is enabled */
  LOG?: boolean;
}
