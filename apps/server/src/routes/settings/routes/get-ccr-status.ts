/**
 * CCR Status Route Handler
 *
 * Returns the current status of Claude Code Router (CCR) installation and server.
 */

import type { Request, Response } from 'express';
import { getCCRStatus } from '../../../lib/ccr.js';

/**
 * Create handler for GET /api/settings/ccr/status
 *
 * Returns CCR installation and running status:
 * - installed: Whether CCR CLI is available
 * - running: Whether CCR server is currently running
 * - port: Port the server is listening on
 * - apiEndpoint: Full API endpoint URL
 */
export function createGetCCRStatusHandler() {
  return async (_req: Request, res: Response) => {
    try {
      const status = await getCCRStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({
        installed: false,
        running: false,
        error: error instanceof Error ? error.message : 'Failed to get CCR status',
      });
    }
  };
}
