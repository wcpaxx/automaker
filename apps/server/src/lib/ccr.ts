/**
 * Claude Code Router (CCR) Utilities
 *
 * Provides functions to detect CCR installation, check server status,
 * and read configuration for integration with Claude Agent SDK.
 */

import { exec } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CCRStatus, CCRConfig } from '@automaker/types';
import { createLogger } from '@automaker/utils';

const execAsync = promisify(exec);
const logger = createLogger('CCR');

/** Default CCR configuration directory */
const CCR_CONFIG_DIR = join(homedir(), '.claude-code-router');
const CCR_CONFIG_FILE = join(CCR_CONFIG_DIR, 'config.json');

// Cache for CCR status to avoid spamming the process list
let statusCache: { status: CCRStatus; timestamp: number } | null = null;
const STATUS_CACHE_TTL = 2000; // 2 seconds

/**
 * Strips ANSI escape codes from a string
 */
function stripAnsi(str: string): string {
  const ansiRegex = new RegExp(
    '[\\u001b\\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]',
    'g'
  );
  return str.replace(ansiRegex, '');
}

/**
 * Get the CCR configuration from disk
 */
export function getCCRConfig(): CCRConfig | null {
  try {
    if (!existsSync(CCR_CONFIG_FILE)) {
      return null;
    }
    const content = readFileSync(CCR_CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as CCRConfig;
  } catch (error) {
    logger.debug('Failed to read CCR config:', error);
    return null;
  }
}

/**
 * Check if CCR CLI is installed (async)
 */
export async function isCCRInstalled(): Promise<boolean> {
  try {
    // Use 'where' on Windows, 'which' on Unix
    const cmd = process.platform === 'win32' ? 'where ccr' : 'which ccr';
    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get CCR server status (async with caching)
 */
export async function getCCRStatus(): Promise<CCRStatus> {
  // Check cache first
  const now = Date.now();
  if (statusCache && now - statusCache.timestamp < STATUS_CACHE_TTL) {
    return statusCache.status;
  }

  const installed = await isCCRInstalled();
  if (!installed) {
    const status = { installed: false, running: false };
    statusCache = { status, timestamp: now };
    return status;
  }

  // Get config once to reuse
  const config = getCCRConfig();
  const port = config?.PORT ?? 3456;
  const rawHost = config?.HOST || '127.0.0.1';
  // If host is 0.0.0.0, use 127.0.0.1 for client connection
  const host = rawHost === '0.0.0.0' ? '127.0.0.1' : rawHost;

  try {
    // Run 'ccr status' to check if server is running
    const { stdout } = await execAsync('ccr status', {
      timeout: 5000,
      encoding: 'utf-8',
    });

    // Parse the output to determine status
    const cleanStdout = stripAnsi(stdout);
    // Use regex to avoid matching "not running"
    // Look for word "running" not preceded by "not" (case insensitive)
    const isRunning = /\b(?<!not\s)running\b/i.test(cleanStdout);

    let status: CCRStatus;
    if (isRunning) {
      status = {
        installed: true,
        running: true,
        port,
        apiEndpoint: `http://${host}:${port}`,
      };
    } else {
      status = { installed: true, running: false, port };
    }

    statusCache = { status, timestamp: now };
    return status;
  } catch (error) {
    // CCR might not be running or command failed
    const status: CCRStatus = {
      installed: true,
      running: false,
      port,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    statusCache = { status, timestamp: now };
    return status;
  }
}

/**
 * Helper to generate environment variables from a valid CCR status and config.
 * Avoids re-checking status if the caller already has it.
 */
export function getCCREnvFromStatus(
  status: CCRStatus,
  config?: CCRConfig | null
): Record<string, string | undefined> | null {
  if (!status.installed || !status.running) {
    return null;
  }

  const effectiveConfig = config ?? getCCRConfig();
  const port = status.port ?? effectiveConfig?.PORT ?? 3456;
  const rawHost = effectiveConfig?.HOST || '127.0.0.1';
  // If host is 0.0.0.0, use 127.0.0.1 for client connection
  const host = rawHost === '0.0.0.0' ? '127.0.0.1' : rawHost;
  const apiKey = effectiveConfig?.APIKEY || 'ccr-default-key';
  const timeoutMs = effectiveConfig?.API_TIMEOUT_MS ?? 600000;

  return {
    ANTHROPIC_AUTH_TOKEN: apiKey,
    ANTHROPIC_BASE_URL: `http://${host}:${port}`,
    NO_PROXY: '127.0.0.1',
    DISABLE_TELEMETRY: 'true',
    DISABLE_COST_WARNINGS: 'true',
    API_TIMEOUT_MS: String(timeoutMs),
    // Unset Bedrock to prevent conflicts
    CLAUDE_CODE_USE_BEDROCK: undefined,
  };
}
