# Phase 10: Testing & Validation

**Status:** `pending`
**Dependencies:** All previous phases
**Estimated Effort:** Medium (comprehensive testing)

---

## Objective

Create comprehensive tests and perform validation to ensure the Cursor CLI integration works correctly across all scenarios.

---

## Tasks

### Task 10.1: Unit Tests - Cursor Provider

**Status:** `pending`

**File:** `apps/server/tests/unit/providers/cursor-provider.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CursorProvider, CursorErrorCode } from '../../../src/providers/cursor-provider';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('CursorProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getName', () => {
    it('should return "cursor"', () => {
      const provider = new CursorProvider();
      expect(provider.getName()).toBe('cursor');
    });
  });

  describe('isInstalled', () => {
    it('should return true when CLI is found in PATH', async () => {
      vi.mocked(execSync).mockReturnValue('/usr/local/bin/cursor-agent\n');
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const provider = new CursorProvider();
      const result = await provider.isInstalled();

      expect(result).toBe(true);
    });

    it('should return false when CLI is not found', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not found');
      });
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const provider = new CursorProvider();
      const result = await provider.isInstalled();

      expect(result).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('should detect API key authentication', async () => {
      process.env.CURSOR_API_KEY = 'test-key';

      const provider = new CursorProvider();
      const result = await provider.checkAuth();

      expect(result.authenticated).toBe(true);
      expect(result.method).toBe('api_key');

      delete process.env.CURSOR_API_KEY;
    });

    it('should detect login authentication from credentials file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ accessToken: 'token' }));

      const provider = new CursorProvider();
      const result = await provider.checkAuth();

      expect(result.authenticated).toBe(true);
      expect(result.method).toBe('login');
    });

    it('should return not authenticated when no credentials', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const provider = new CursorProvider();
      const result = await provider.checkAuth();

      expect(result.authenticated).toBe(false);
      expect(result.method).toBe('none');
    });
  });

  describe('parseStreamLine', () => {
    it('should parse valid JSON event', () => {
      const provider = new CursorProvider();
      const line = '{"type":"system","subtype":"init","session_id":"abc"}';

      const result = (provider as any).parseStreamLine(line);

      expect(result).toEqual({
        type: 'system',
        subtype: 'init',
        session_id: 'abc',
      });
    });

    it('should return null for invalid JSON', () => {
      const provider = new CursorProvider();
      const result = (provider as any).parseStreamLine('not json');

      expect(result).toBeNull();
    });

    it('should return null for empty lines', () => {
      const provider = new CursorProvider();
      expect((provider as any).parseStreamLine('')).toBeNull();
      expect((provider as any).parseStreamLine('   ')).toBeNull();
    });
  });

  describe('mapError', () => {
    it('should map authentication errors', () => {
      const provider = new CursorProvider();

      const error = (provider as any).mapError('Error: not authenticated', 1);

      expect(error.code).toBe(CursorErrorCode.NOT_AUTHENTICATED);
      expect(error.recoverable).toBe(true);
      expect(error.suggestion).toBeDefined();
    });

    it('should map rate limit errors', () => {
      const provider = new CursorProvider();

      const error = (provider as any).mapError('Rate limit exceeded', 1);

      expect(error.code).toBe(CursorErrorCode.RATE_LIMITED);
      expect(error.recoverable).toBe(true);
    });

    it('should map network errors', () => {
      const provider = new CursorProvider();

      const error = (provider as any).mapError('ECONNREFUSED', 1);

      expect(error.code).toBe(CursorErrorCode.NETWORK_ERROR);
      expect(error.recoverable).toBe(true);
    });

    it('should return unknown error for unrecognized messages', () => {
      const provider = new CursorProvider();

      const error = (provider as any).mapError('Something weird happened', 1);

      expect(error.code).toBe(CursorErrorCode.UNKNOWN);
    });
  });

  describe('getAvailableModels', () => {
    it('should return all Cursor models', () => {
      const provider = new CursorProvider();
      const models = provider.getAvailableModels();

      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.provider === 'cursor')).toBe(true);
      expect(models.some((m) => m.id.includes('auto'))).toBe(true);
    });
  });
});
```

### Task 10.2: Unit Tests - Provider Factory

**Status:** `pending`

**File:** `apps/server/tests/unit/providers/provider-factory.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ProviderFactory } from '../../../src/providers/provider-factory';
import { ClaudeProvider } from '../../../src/providers/claude-provider';
import { CursorProvider } from '../../../src/providers/cursor-provider';

describe('ProviderFactory', () => {
  describe('getProviderNameForModel', () => {
    it('should route cursor-prefixed models to cursor', () => {
      expect(ProviderFactory.getProviderNameForModel('cursor-auto')).toBe('cursor');
      expect(ProviderFactory.getProviderNameForModel('cursor-gpt-4o')).toBe('cursor');
      expect(ProviderFactory.getProviderNameForModel('cursor-claude-sonnet-4')).toBe('cursor');
    });

    it('should route claude models to claude', () => {
      expect(ProviderFactory.getProviderNameForModel('claude-sonnet-4')).toBe('claude');
      expect(ProviderFactory.getProviderNameForModel('opus')).toBe('claude');
      expect(ProviderFactory.getProviderNameForModel('sonnet')).toBe('claude');
      expect(ProviderFactory.getProviderNameForModel('haiku')).toBe('claude');
    });

    it('should default unknown models to claude', () => {
      expect(ProviderFactory.getProviderNameForModel('unknown-model')).toBe('claude');
      expect(ProviderFactory.getProviderNameForModel('random')).toBe('claude');
    });
  });

  describe('getProviderForModel', () => {
    it('should return CursorProvider for cursor models', () => {
      const provider = ProviderFactory.getProviderForModel('cursor-auto');
      expect(provider).toBeInstanceOf(CursorProvider);
      expect(provider.getName()).toBe('cursor');
    });

    it('should return ClaudeProvider for claude models', () => {
      const provider = ProviderFactory.getProviderForModel('sonnet');
      expect(provider).toBeInstanceOf(ClaudeProvider);
      expect(provider.getName()).toBe('claude');
    });
  });

  describe('getAllProviders', () => {
    it('should return both providers', () => {
      const providers = ProviderFactory.getAllProviders();
      const names = providers.map((p) => p.getName());

      expect(names).toContain('claude');
      expect(names).toContain('cursor');
    });
  });

  describe('getProviderByName', () => {
    it('should return correct provider by name', () => {
      expect(ProviderFactory.getProviderByName('cursor')?.getName()).toBe('cursor');
      expect(ProviderFactory.getProviderByName('claude')?.getName()).toBe('claude');
      expect(ProviderFactory.getProviderByName('unknown')).toBeNull();
    });
  });

  describe('getAllAvailableModels', () => {
    it('should include models from all providers', () => {
      const models = ProviderFactory.getAllAvailableModels();

      const cursorModels = models.filter((m) => m.provider === 'cursor');
      const claudeModels = models.filter((m) => m.provider === 'claude');

      expect(cursorModels.length).toBeGreaterThan(0);
      expect(claudeModels.length).toBeGreaterThan(0);
    });
  });
});
```

### Task 10.3: Unit Tests - Types

**Status:** `pending`

**File:** `libs/types/tests/cursor-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  CURSOR_MODEL_MAP,
  cursorModelHasThinking,
  getCursorModelLabel,
  getAllCursorModelIds,
  CursorModelId,
} from '../src/cursor-models';
import { profileHasThinking, getProfileModelString, AIProfile } from '../src/settings';

describe('Cursor Model Types', () => {
  describe('CURSOR_MODEL_MAP', () => {
    it('should have all required models', () => {
      const requiredModels: CursorModelId[] = [
        'auto',
        'claude-sonnet-4',
        'claude-sonnet-4-thinking',
        'gpt-4o',
        'gpt-4o-mini',
      ];

      for (const model of requiredModels) {
        expect(CURSOR_MODEL_MAP[model]).toBeDefined();
        expect(CURSOR_MODEL_MAP[model].id).toBe(model);
      }
    });

    it('should have valid tier values', () => {
      for (const config of Object.values(CURSOR_MODEL_MAP)) {
        expect(['free', 'pro']).toContain(config.tier);
      }
    });
  });

  describe('cursorModelHasThinking', () => {
    it('should return true for thinking models', () => {
      expect(cursorModelHasThinking('claude-sonnet-4-thinking')).toBe(true);
      expect(cursorModelHasThinking('o3-mini')).toBe(true);
    });

    it('should return false for non-thinking models', () => {
      expect(cursorModelHasThinking('auto')).toBe(false);
      expect(cursorModelHasThinking('gpt-4o')).toBe(false);
      expect(cursorModelHasThinking('claude-sonnet-4')).toBe(false);
    });
  });

  describe('getCursorModelLabel', () => {
    it('should return correct labels', () => {
      expect(getCursorModelLabel('auto')).toBe('Auto (Recommended)');
      expect(getCursorModelLabel('gpt-4o')).toBe('GPT-4o');
    });

    it('should return model ID for unknown models', () => {
      expect(getCursorModelLabel('unknown' as CursorModelId)).toBe('unknown');
    });
  });
});

describe('Profile Helpers', () => {
  describe('profileHasThinking', () => {
    it('should detect Claude thinking levels', () => {
      const profile: AIProfile = {
        id: '1',
        name: 'Test',
        description: '',
        provider: 'claude',
        model: 'sonnet',
        thinkingLevel: 'high',
        isBuiltIn: false,
      };
      expect(profileHasThinking(profile)).toBe(true);

      profile.thinkingLevel = 'none';
      expect(profileHasThinking(profile)).toBe(false);
    });

    it('should detect Cursor thinking models', () => {
      const profile: AIProfile = {
        id: '1',
        name: 'Test',
        description: '',
        provider: 'cursor',
        cursorModel: 'claude-sonnet-4-thinking',
        isBuiltIn: false,
      };
      expect(profileHasThinking(profile)).toBe(true);

      profile.cursorModel = 'gpt-4o';
      expect(profileHasThinking(profile)).toBe(false);
    });
  });

  describe('getProfileModelString', () => {
    it('should format Cursor models correctly', () => {
      const profile: AIProfile = {
        id: '1',
        name: 'Test',
        description: '',
        provider: 'cursor',
        cursorModel: 'gpt-4o',
        isBuiltIn: false,
      };
      expect(getProfileModelString(profile)).toBe('cursor-gpt-4o');
    });

    it('should format Claude models correctly', () => {
      const profile: AIProfile = {
        id: '1',
        name: 'Test',
        description: '',
        provider: 'claude',
        model: 'sonnet',
        isBuiltIn: false,
      };
      expect(getProfileModelString(profile)).toBe('sonnet');
    });
  });
});
```

### Task 10.4: Integration Tests

**Status:** `pending`

**File:** `apps/server/tests/integration/cursor-integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CursorProvider } from '../../src/providers/cursor-provider';
import { ProviderFactory } from '../../src/providers/provider-factory';

describe('Cursor Integration (requires cursor-agent)', () => {
  let provider: CursorProvider;
  let isInstalled: boolean;

  beforeAll(async () => {
    provider = new CursorProvider();
    isInstalled = await provider.isInstalled();
  });

  describe('when cursor-agent is installed', () => {
    it.skipIf(!isInstalled)('should get version', async () => {
      const version = await provider.getVersion();
      expect(version).toBeTruthy();
      expect(typeof version).toBe('string');
    });

    it.skipIf(!isInstalled)('should check auth status', async () => {
      const auth = await provider.checkAuth();
      expect(auth).toHaveProperty('authenticated');
      expect(auth).toHaveProperty('method');
    });

    it.skipIf(!isInstalled)('should detect installation', async () => {
      const status = await provider.detectInstallation();
      expect(status.installed).toBe(true);
      expect(status.path).toBeTruthy();
    });
  });

  describe('when cursor-agent is not installed', () => {
    it.skipIf(isInstalled)('should report not installed', async () => {
      const status = await provider.detectInstallation();
      expect(status.installed).toBe(false);
    });
  });
});
```

### Task 10.5: E2E Tests

**Status:** `pending`

**File:** `apps/ui/tests/e2e/cursor-setup.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cursor Setup Wizard', () => {
  test('should show Cursor setup step', async ({ page }) => {
    // Navigate to setup (fresh install)
    await page.goto('/setup');

    // Wait for Cursor step to appear
    await expect(page.getByText('Cursor CLI Setup')).toBeVisible();
    await expect(page.getByText('Optional')).toBeVisible();
  });

  test('should allow skipping Cursor setup', async ({ page }) => {
    await page.goto('/setup');

    // Find and click skip button
    await page.getByRole('button', { name: 'Skip for now' }).click();

    // Should proceed to next step
    await expect(page.getByText('Cursor CLI Setup')).not.toBeVisible();
  });

  test('should show installation instructions when not installed', async ({ page }) => {
    await page.goto('/setup');

    // Check for install command
    await expect(page.getByText('curl https://cursor.com/install')).toBeVisible();
  });
});

test.describe('Cursor Settings', () => {
  test('should show Cursor tab in settings', async ({ page }) => {
    await page.goto('/settings/providers');

    // Should have tabs for both providers
    await expect(page.getByRole('tab', { name: 'Claude' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Cursor' })).toBeVisible();
  });

  test('should switch between provider tabs', async ({ page }) => {
    await page.goto('/settings/providers');

    // Click Cursor tab
    await page.getByRole('tab', { name: 'Cursor' }).click();

    // Should show Cursor settings
    await expect(page.getByText('Cursor CLI Status')).toBeVisible();
  });
});
```

### Task 10.6: Manual Testing Checklist

**Status:** `pending`

Create a manual testing checklist:

```markdown
## Manual Testing Checklist

### Setup Flow

- [ ] Fresh install shows Cursor step
- [ ] Can skip Cursor setup
- [ ] Installation status is accurate
- [ ] Login flow works (copy command, poll for auth)
- [ ] Refresh button updates status

### Settings

- [ ] Provider tabs work
- [ ] Cursor status shows correctly
- [ ] Model selection works
- [ ] Default model saves
- [ ] Enabled models save

### Profiles

- [ ] Can create Cursor profile
- [ ] Provider switch resets options
- [ ] Cursor models show thinking badge
- [ ] Built-in Cursor profiles appear
- [ ] Profile cards show provider info

### Execution

- [ ] Tasks with Cursor models execute
- [ ] Streaming works correctly
- [ ] Tool calls are displayed
- [ ] Errors show suggestions
- [ ] Can abort Cursor tasks

### Log Viewer

- [ ] Cursor events parsed correctly
- [ ] Tool calls categorized
- [ ] File paths highlighted
- [ ] Provider badge shown

### Edge Cases

- [ ] Switch provider mid-session
- [ ] Cursor not installed handling
- [ ] Network errors handled
- [ ] Rate limiting handled
- [ ] Auth expired handling
```

---

## Verification

### Test 1: Run All Unit Tests

```bash
pnpm test:unit
```

All tests should pass.

### Test 2: Run Integration Tests

```bash
pnpm test:integration
```

Tests requiring cursor-agent will be skipped if not installed.

### Test 3: Run E2E Tests

```bash
pnpm test:e2e
```

Browser tests should pass.

### Test 4: Type Check

```bash
pnpm typecheck
```

No TypeScript errors.

### Test 5: Lint Check

```bash
pnpm lint
```

No linting errors.

### Test 6: Build

```bash
pnpm build
```

Build should succeed without errors.

---

## Verification Checklist

Before marking this phase complete:

- [ ] Unit tests pass (cursor-provider)
- [ ] Unit tests pass (provider-factory)
- [ ] Unit tests pass (types)
- [ ] Integration tests pass (or skip if not installed)
- [ ] E2E tests pass
- [ ] Manual testing checklist completed
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Build succeeds
- [ ] Documentation updated

---

## Files Changed

| File                                                        | Action | Description       |
| ----------------------------------------------------------- | ------ | ----------------- |
| `apps/server/tests/unit/providers/cursor-provider.test.ts`  | Create | Provider tests    |
| `apps/server/tests/unit/providers/provider-factory.test.ts` | Create | Factory tests     |
| `libs/types/tests/cursor-types.test.ts`                     | Create | Type tests        |
| `apps/server/tests/integration/cursor-integration.test.ts`  | Create | Integration tests |
| `apps/ui/tests/e2e/cursor-setup.spec.ts`                    | Create | E2E tests         |

---

## Notes

- Integration tests may be skipped if cursor-agent is not installed
- E2E tests should work regardless of cursor-agent installation
- Manual testing should cover both installed and not-installed scenarios
