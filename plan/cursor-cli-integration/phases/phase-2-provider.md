# Phase 2: Cursor Provider Implementation

**Status:** `pending`
**Dependencies:** Phase 1 (Types)
**Estimated Effort:** Medium-Large (core implementation)

---

## Objective

Implement the main `CursorProvider` class that spawns the cursor-agent CLI and streams responses in the AutoMaker provider format.

---

## Tasks

### Task 2.1: Create Cursor Provider

**Status:** `pending`

**File:** `apps/server/src/providers/cursor-provider.ts`

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BaseProvider } from './base-provider';
import {
  ProviderConfig,
  ExecuteOptions,
  ProviderMessage,
  InstallationStatus,
  ModelDefinition,
} from './types';
import {
  CursorModelId,
  CursorStreamEvent,
  CursorSystemEvent,
  CursorAssistantEvent,
  CursorToolCallEvent,
  CursorResultEvent,
  CURSOR_MODEL_MAP,
  CursorAuthStatus,
} from '@automaker/types';
import { createLogger, isAbortError } from '@automaker/utils';
import { spawnJSONLProcess, type SubprocessOptions } from '@automaker/platform';

// Create logger for this module
const logger = createLogger('CursorProvider');

/**
 * Cursor-specific error codes for detailed error handling
 */
export enum CursorErrorCode {
  NOT_INSTALLED = 'CURSOR_NOT_INSTALLED',
  NOT_AUTHENTICATED = 'CURSOR_NOT_AUTHENTICATED',
  RATE_LIMITED = 'CURSOR_RATE_LIMITED',
  MODEL_UNAVAILABLE = 'CURSOR_MODEL_UNAVAILABLE',
  NETWORK_ERROR = 'CURSOR_NETWORK_ERROR',
  PROCESS_CRASHED = 'CURSOR_PROCESS_CRASHED',
  TIMEOUT = 'CURSOR_TIMEOUT',
  UNKNOWN = 'CURSOR_UNKNOWN_ERROR',
}

export interface CursorError extends Error {
  code: CursorErrorCode;
  recoverable: boolean;
  suggestion?: string;
}

/**
 * CursorProvider - Integrates cursor-agent CLI as an AI provider
 *
 * Uses the cursor-agent CLI with --output-format stream-json for streaming responses.
 * Normalizes Cursor events to the AutoMaker ProviderMessage format.
 */
export class CursorProvider extends BaseProvider {
  private static CLI_NAME = 'cursor-agent';

  /**
   * Installation paths based on official cursor-agent install script:
   *
   * Linux/macOS:
   * - Binary: ~/.local/share/cursor-agent/versions/<version>/cursor-agent
   * - Symlink: ~/.local/bin/cursor-agent -> versions/<version>/cursor-agent
   *
   * The install script creates versioned folders like:
   *   ~/.local/share/cursor-agent/versions/2025.12.17-996666f/cursor-agent
   * And symlinks to ~/.local/bin/cursor-agent
   */
  private static COMMON_PATHS: Record<string, string[]> = {
    linux: [
      path.join(os.homedir(), '.local/bin/cursor-agent'), // Primary symlink location
      '/usr/local/bin/cursor-agent',
    ],
    darwin: [
      path.join(os.homedir(), '.local/bin/cursor-agent'), // Primary symlink location
      '/usr/local/bin/cursor-agent',
    ],
    win32: [
      path.join(os.homedir(), 'AppData/Local/Programs/cursor-agent/cursor-agent.exe'),
      path.join(os.homedir(), '.local/bin/cursor-agent.exe'),
      'C:\\Program Files\\cursor-agent\\cursor-agent.exe',
    ],
  };

  // Version data directory where cursor-agent stores versions
  private static VERSIONS_DIR = path.join(os.homedir(), '.local/share/cursor-agent/versions');

  private cliPath: string | null = null;
  private currentProcess: ChildProcess | null = null;

  constructor(config: ProviderConfig = {}) {
    super(config);
    this.cliPath = config.cliPath || this.findCliPath();
  }

  getName(): string {
    return 'cursor';
  }

  /**
   * Find cursor-agent CLI in PATH or common installation locations
   */
  private findCliPath(): string | null {
    // Try 'which' / 'where' first
    try {
      const cmd = process.platform === 'win32' ? 'where cursor-agent' : 'which cursor-agent';
      const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];
      if (result && fs.existsSync(result)) {
        return result;
      }
    } catch {
      // Not in PATH
    }

    // Check common installation paths for current platform
    const platform = process.platform as 'linux' | 'darwin' | 'win32';
    const platformPaths = CursorProvider.COMMON_PATHS[platform] || [];

    for (const p of platformPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Also check versions directory for any installed version
    if (fs.existsSync(CursorProvider.VERSIONS_DIR)) {
      try {
        const versions = fs
          .readdirSync(CursorProvider.VERSIONS_DIR)
          .filter((v) => !v.startsWith('.'))
          .sort()
          .reverse(); // Most recent first

        for (const version of versions) {
          const binaryName = platform === 'win32' ? 'cursor-agent.exe' : 'cursor-agent';
          const versionPath = path.join(CursorProvider.VERSIONS_DIR, version, binaryName);
          if (fs.existsSync(versionPath)) {
            return versionPath;
          }
        }
      } catch {
        // Ignore directory read errors
      }
    }

    return null;
  }

  /**
   * Check if Cursor CLI is installed
   */
  async isInstalled(): Promise<boolean> {
    return this.cliPath !== null;
  }

  /**
   * Get Cursor CLI version
   */
  async getVersion(): Promise<string | null> {
    if (!this.cliPath) return null;

    try {
      const result = execSync(`"${this.cliPath}" --version`, {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Check authentication status
   */
  async checkAuth(): Promise<CursorAuthStatus> {
    if (!this.cliPath) {
      return { authenticated: false, method: 'none' };
    }

    // Check for API key in environment
    if (process.env.CURSOR_API_KEY) {
      return { authenticated: true, method: 'api_key' };
    }

    // Check for credentials file (location may vary)
    const credentialPaths = [
      path.join(os.homedir(), '.cursor', 'credentials.json'),
      path.join(os.homedir(), '.config', 'cursor', 'credentials.json'),
    ];

    for (const credPath of credentialPaths) {
      if (fs.existsSync(credPath)) {
        try {
          const content = fs.readFileSync(credPath, 'utf8');
          const creds = JSON.parse(content);
          if (creds.accessToken || creds.token) {
            return { authenticated: true, method: 'login', hasCredentialsFile: true };
          }
        } catch {
          // Invalid credentials file
        }
      }
    }

    // Try running a simple command to check auth
    try {
      execSync(`"${this.cliPath}" --version`, {
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env },
      });
      // If we get here without error, assume authenticated
      // (actual auth check would need a real API call)
      return { authenticated: true, method: 'login' };
    } catch (error: any) {
      if (error.stderr?.includes('not authenticated') || error.stderr?.includes('log in')) {
        return { authenticated: false, method: 'none' };
      }
    }

    return { authenticated: false, method: 'none' };
  }

  /**
   * Detect installation status (required by BaseProvider)
   */
  async detectInstallation(): Promise<InstallationStatus> {
    const installed = await this.isInstalled();
    const version = installed ? await this.getVersion() : undefined;
    const auth = await this.checkAuth();

    return {
      installed,
      version: version || undefined,
      path: this.cliPath || undefined,
      method: 'cli',
      hasApiKey: !!process.env.CURSOR_API_KEY,
      authenticated: auth.authenticated,
    };
  }

  /**
   * Get available Cursor models
   */
  getAvailableModels(): ModelDefinition[] {
    return Object.entries(CURSOR_MODEL_MAP).map(([id, config]) => ({
      id: `cursor-${id}`,
      name: config.label,
      modelString: id,
      provider: 'cursor',
      description: config.description,
      tier: config.tier === 'pro' ? 'premium' : 'basic',
      supportsTools: true,
      supportsVision: false, // Cursor CLI may not support vision
    }));
  }

  /**
   * Create a CursorError with details
   */
  private createError(
    code: CursorErrorCode,
    message: string,
    recoverable: boolean = false,
    suggestion?: string
  ): CursorError {
    const error = new Error(message) as CursorError;
    error.code = code;
    error.recoverable = recoverable;
    error.suggestion = suggestion;
    error.name = 'CursorError';
    return error;
  }

  /**
   * Map stderr/exit codes to detailed CursorError
   */
  private mapError(stderr: string, exitCode: number | null): CursorError {
    const lower = stderr.toLowerCase();

    if (
      lower.includes('not authenticated') ||
      lower.includes('please log in') ||
      lower.includes('unauthorized')
    ) {
      return this.createError(
        CursorErrorCode.NOT_AUTHENTICATED,
        'Cursor CLI is not authenticated',
        true,
        'Run "cursor-agent login" to authenticate with your browser'
      );
    }

    if (
      lower.includes('rate limit') ||
      lower.includes('too many requests') ||
      lower.includes('429')
    ) {
      return this.createError(
        CursorErrorCode.RATE_LIMITED,
        'Cursor API rate limit exceeded',
        true,
        'Wait a few minutes and try again, or upgrade to Cursor Pro'
      );
    }

    if (
      lower.includes('model not available') ||
      lower.includes('invalid model') ||
      lower.includes('unknown model')
    ) {
      return this.createError(
        CursorErrorCode.MODEL_UNAVAILABLE,
        'Requested model is not available',
        true,
        'Try using "auto" mode or select a different model'
      );
    }

    if (
      lower.includes('network') ||
      lower.includes('connection') ||
      lower.includes('econnrefused') ||
      lower.includes('timeout')
    ) {
      return this.createError(
        CursorErrorCode.NETWORK_ERROR,
        'Network connection error',
        true,
        'Check your internet connection and try again'
      );
    }

    if (exitCode === 137 || lower.includes('killed') || lower.includes('sigterm')) {
      return this.createError(
        CursorErrorCode.PROCESS_CRASHED,
        'Cursor agent process was terminated',
        true,
        'The process may have run out of memory. Try a simpler task.'
      );
    }

    return this.createError(
      CursorErrorCode.UNKNOWN,
      stderr || `Cursor agent exited with code ${exitCode}`,
      false
    );
  }

  /**
   * Parse a line of stream-json output
   */
  private parseStreamLine(line: string): CursorStreamEvent | null {
    if (!line.trim()) return null;

    try {
      return JSON.parse(line) as CursorStreamEvent;
    } catch {
      logger.debug('[CursorProvider] Failed to parse stream line:', line);
      return null;
    }
  }

  /**
   * Convert Cursor event to AutoMaker ProviderMessage format
   */
  private normalizeEvent(event: CursorStreamEvent): ProviderMessage | null {
    switch (event.type) {
      case 'system':
        // System init - we capture session_id but don't yield a message
        return null;

      case 'user':
        // User message - already handled by caller
        return null;

      case 'assistant': {
        const assistantEvent = event as CursorAssistantEvent;
        return {
          type: 'assistant',
          session_id: assistantEvent.session_id,
          message: {
            role: 'assistant',
            content: assistantEvent.message.content.map((c) => ({
              type: 'text' as const,
              text: c.text,
            })),
          },
        };
      }

      case 'tool_call': {
        const toolEvent = event as CursorToolCallEvent;
        const toolCall = toolEvent.tool_call;

        // Determine tool name and input
        let toolName: string;
        let toolInput: unknown;

        if (toolCall.readToolCall) {
          toolName = 'Read';
          toolInput = { file_path: toolCall.readToolCall.args.path };
        } else if (toolCall.writeToolCall) {
          toolName = 'Write';
          toolInput = {
            file_path: toolCall.writeToolCall.args.path,
            content: toolCall.writeToolCall.args.fileText,
          };
        } else if (toolCall.function) {
          toolName = toolCall.function.name;
          try {
            toolInput = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            toolInput = { raw: toolCall.function.arguments };
          }
        } else {
          return null;
        }

        // For started events, emit tool_use
        if (toolEvent.subtype === 'started') {
          return {
            type: 'assistant',
            session_id: toolEvent.session_id,
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  name: toolName,
                  tool_use_id: toolEvent.call_id,
                  input: toolInput,
                },
              ],
            },
          };
        }

        // For completed events, emit tool_result
        if (toolEvent.subtype === 'completed') {
          let resultContent = '';

          if (toolCall.readToolCall?.result?.success) {
            resultContent = toolCall.readToolCall.result.success.content;
          } else if (toolCall.writeToolCall?.result?.success) {
            resultContent = `Wrote ${toolCall.writeToolCall.result.success.linesCreated} lines to ${toolCall.writeToolCall.result.success.path}`;
          }

          return {
            type: 'assistant',
            session_id: toolEvent.session_id,
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolEvent.call_id,
                  content: resultContent,
                },
              ],
            },
          };
        }

        return null;
      }

      case 'result': {
        const resultEvent = event as CursorResultEvent;

        if (resultEvent.is_error) {
          return {
            type: 'error',
            session_id: resultEvent.session_id,
            error: resultEvent.error || resultEvent.result || 'Unknown error',
          };
        }

        return {
          type: 'result',
          subtype: 'success',
          session_id: resultEvent.session_id,
          result: resultEvent.result,
        };
      }

      default:
        return null;
    }
  }

  /**
   * Execute a prompt using Cursor CLI with streaming
   */
  async *executeQuery(options: ExecuteOptions): AsyncGenerator<ProviderMessage> {
    if (!this.cliPath) {
      throw this.createError(
        CursorErrorCode.NOT_INSTALLED,
        'Cursor CLI is not installed',
        true,
        'Install with: curl https://cursor.com/install -fsS | bash'
      );
    }

    // Extract model from options (strip 'cursor-' prefix if present)
    let model = options.model || 'auto';
    if (model.startsWith('cursor-')) {
      model = model.substring(7);
    }

    const cwd = options.cwd || process.cwd();

    // Build prompt content
    let promptText: string;
    if (typeof options.prompt === 'string') {
      promptText = options.prompt;
    } else if (Array.isArray(options.prompt)) {
      promptText = options.prompt
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text)
        .join('\n');
    } else {
      throw new Error('Invalid prompt format');
    }

    // Build CLI arguments
    const args: string[] = [
      '-p', // Print mode (non-interactive)
      '--force', // Allow file modifications
      '--output-format',
      'stream-json',
      '--stream-partial-output', // Real-time streaming
    ];

    // Add model if not auto
    if (model !== 'auto') {
      args.push('--model', model);
    }

    // Add the prompt
    args.push(promptText);

    logger.debug(`[CursorProvider] Executing: ${this.cliPath} ${args.slice(0, 6).join(' ')}...`);

    // Use spawnJSONLProcess from @automaker/platform for JSONL streaming
    // This handles line buffering, timeouts, and abort signals automatically
    const subprocessOptions: SubprocessOptions = {
      command: this.cliPath,
      args,
      cwd,
      env: { ...process.env },
      abortController: options.abortController,
      timeout: 120000, // 2 min timeout for CLI operations (may take longer than default 30s)
    };

    let sessionId: string | undefined;

    try {
      // spawnJSONLProcess yields parsed JSON objects, handles errors
      for await (const rawEvent of spawnJSONLProcess(subprocessOptions)) {
        const event = rawEvent as CursorStreamEvent;

        // Capture session ID from system init
        if (event.type === 'system' && (event as CursorSystemEvent).subtype === 'init') {
          sessionId = event.session_id;
        }

        // Normalize and yield the event
        const normalized = this.normalizeEvent(event);
        if (normalized) {
          // Ensure session_id is always set
          if (!normalized.session_id && sessionId) {
            normalized.session_id = sessionId;
          }
          yield normalized;
        }
      }
    } catch (error) {
      // Use isAbortError from @automaker/utils for abort detection
      if (isAbortError(error)) {
        return; // Clean abort, don't throw
      }

      // Map CLI errors to CursorError
      if (error instanceof Error && 'stderr' in error) {
        throw this.mapError((error as any).stderr || error.message, (error as any).exitCode);
      }
      throw error;
    }
  }

  /**
   * Abort the current execution
   */
  abort(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }

  /**
   * Check if a feature is supported
   */
  supportsFeature(feature: string): boolean {
    const supported = ['tools', 'text', 'streaming'];
    return supported.includes(feature);
  }
}
```

### Task 2.2: Create Cursor Config Manager

**Status:** `pending`

**File:** `apps/server/src/providers/cursor-config-manager.ts`

```typescript
import * as path from 'path';
import { CursorCliConfig, CursorModelId } from '@automaker/types';
import { createLogger, mkdirSafe, existsSafe } from '@automaker/utils';
import { getAutomakerDir } from '@automaker/platform';
import { secureFs } from '@automaker/platform';

// Create logger for this module
const logger = createLogger('CursorConfigManager');

/**
 * Manages Cursor CLI configuration
 * Config location: .automaker/cursor-config.json
 */
export class CursorConfigManager {
  private configPath: string;
  private config: CursorCliConfig;

  constructor(projectPath: string) {
    // Use getAutomakerDir for consistent path resolution
    this.configPath = path.join(getAutomakerDir(projectPath), 'cursor-config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): CursorCliConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      logger.warn('[CursorConfigManager] Failed to load config:', error);
    }

    // Return default config
    return {
      defaultModel: 'auto',
      models: ['auto', 'claude-sonnet-4', 'gpt-4o-mini'],
    };
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      logger.debug('[CursorConfigManager] Config saved');
    } catch (error) {
      logger.error('[CursorConfigManager] Failed to save config:', error);
      throw error;
    }
  }

  getConfig(): CursorCliConfig {
    return { ...this.config };
  }

  getDefaultModel(): CursorModelId {
    return this.config.defaultModel || 'auto';
  }

  setDefaultModel(model: CursorModelId): void {
    this.config.defaultModel = model;
    this.saveConfig();
  }

  getEnabledModels(): CursorModelId[] {
    return this.config.models || ['auto'];
  }

  setEnabledModels(models: CursorModelId[]): void {
    this.config.models = models;
    this.saveConfig();
  }

  addModel(model: CursorModelId): void {
    if (!this.config.models) {
      this.config.models = [];
    }
    if (!this.config.models.includes(model)) {
      this.config.models.push(model);
      this.saveConfig();
    }
  }

  removeModel(model: CursorModelId): void {
    if (this.config.models) {
      this.config.models = this.config.models.filter((m) => m !== model);
      this.saveConfig();
    }
  }
}
```

---

## Verification

### Test 1: Provider Instantiation

```typescript
// test-cursor-provider.ts
import { CursorProvider } from './apps/server/src/providers/cursor-provider';

const provider = new CursorProvider();
console.log('Provider name:', provider.getName()); // Should be 'cursor'

const status = await provider.detectInstallation();
console.log('Installation status:', status);

const models = provider.getAvailableModels();
console.log('Available models:', models.length);
```

### Test 2: CLI Detection (requires cursor-agent installed)

```bash
# Check if cursor-agent is found
node -e "
const { CursorProvider } = require('./apps/server/dist/providers/cursor-provider');
const p = new CursorProvider();
p.isInstalled().then(installed => {
  console.log('Installed:', installed);
  if (installed) {
    p.getVersion().then(v => console.log('Version:', v));
    p.checkAuth().then(a => console.log('Auth:', a));
  }
});
"
```

### Test 3: Simple Query (requires cursor-agent authenticated)

```typescript
// test-cursor-query.ts
import { CursorProvider } from './apps/server/src/providers/cursor-provider';

const provider = new CursorProvider();
const stream = provider.executeQuery({
  prompt: 'What is 2 + 2? Reply with just the number.',
  model: 'auto',
  cwd: process.cwd(),
});

for await (const msg of stream) {
  console.log('Message:', JSON.stringify(msg, null, 2));
}
```

### Test 4: Error Handling

```typescript
// Test with invalid model
try {
  const stream = provider.executeQuery({
    prompt: 'test',
    model: 'invalid-model-xyz',
    cwd: process.cwd(),
  });
  for await (const msg of stream) {
    // Should not reach here
  }
} catch (error) {
  console.log('Error code:', error.code);
  console.log('Suggestion:', error.suggestion);
}
```

---

## Verification Checklist

Before marking this phase complete:

- [ ] `cursor-provider.ts` compiles without errors
- [ ] `cursor-config-manager.ts` compiles without errors
- [ ] Provider returns correct name ('cursor')
- [ ] `detectInstallation()` correctly detects CLI
- [ ] `getAvailableModels()` returns model definitions
- [ ] `executeQuery()` streams messages (if CLI installed)
- [ ] Errors are properly mapped to CursorError
- [ ] Abort signal terminates process

---

## Files Changed

| File                                                 | Action | Description       |
| ---------------------------------------------------- | ------ | ----------------- |
| `apps/server/src/providers/cursor-provider.ts`       | Create | Main provider     |
| `apps/server/src/providers/cursor-config-manager.ts` | Create | Config management |

---

## Known Limitations

1. **Windows Support**: CLI path detection may need adjustment
2. **Vision**: Cursor CLI may not support image inputs
3. **Resume**: Session resumption not implemented in Phase 2

---

## Notes

- The provider uses `--stream-partial-output` for real-time character streaming
- Tool call events are normalized to match Claude SDK format
- Session IDs are captured from system init event
