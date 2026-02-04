/**
 * Global Settings Accessor
 *
 * Provides a centralized way to access global settings from anywhere in the codebase
 * without needing to pass SettingsService through every function call.
 *
 * This is particularly useful for:
 * - Provider-level code that needs global settings (like CCR routing)
 * - Middleware that needs to check settings
 * - Utility functions that need global configuration
 *
 * Usage:
 * 1. Initialize at server startup: initGlobalSettingsAccessor(settingsService)
 * 2. Access anywhere: const settings = await getGlobalSettingsFromAccessor()
 *
 * Design decisions:
 * - Uses a module-level singleton pattern for simplicity
 * - Returns null if not initialized (graceful degradation)
 * - Async to support potential caching/optimization in the future
 */

import type { GlobalSettings } from '@automaker/types';

/**
 * Minimal interface for settings access
 * This allows decoupling from the full SettingsService
 */
interface GlobalSettingsProvider {
  getGlobalSettings(): Promise<GlobalSettings | null>;
}

/**
 * Module-level singleton for settings access
 */
let settingsProvider: GlobalSettingsProvider | null = null;

/**
 * Initialize the global settings accessor
 *
 * Should be called once at server startup with the SettingsService instance.
 *
 * @param provider - The SettingsService or compatible provider
 */
export function initGlobalSettingsAccessor(provider: GlobalSettingsProvider): void {
  settingsProvider = provider;
}

/**
 * Get global settings from the accessor
 *
 * Returns null if the accessor hasn't been initialized.
 * Callers should handle the null case gracefully.
 *
 * @returns Promise resolving to GlobalSettings or null
 */
export async function getGlobalSettingsFromAccessor(): Promise<GlobalSettings | null> {
  if (!settingsProvider) {
    return null;
  }
  return settingsProvider.getGlobalSettings();
}

/**
 * Check if CCR is enabled in global settings
 *
 * Convenience function for the common CCR check pattern.
 * Returns false if settings are not available.
 *
 * @returns Promise resolving to boolean
 */
export async function isCCREnabled(): Promise<boolean> {
  const settings = await getGlobalSettingsFromAccessor();
  return settings?.ccrEnabled ?? false;
}

/**
 * Reset the accessor (useful for testing)
 */
export function resetGlobalSettingsAccessor(): void {
  settingsProvider = null;
}
