# Phase 3: Provider Factory Integration

**Status:** `pending`
**Dependencies:** Phase 2 (Provider)
**Estimated Effort:** Small (routing logic only)

---

## Objective

Integrate CursorProvider into the ProviderFactory so models are automatically routed to the correct provider.

---

## Tasks

### Task 3.1: Update Provider Factory

**Status:** `pending`

**File:** `apps/server/src/providers/provider-factory.ts`

Add Cursor provider import and routing:

```typescript
import { CursorProvider } from './cursor-provider';
import { CURSOR_MODEL_MAP } from '@automaker/types';

export class ProviderFactory {
  /**
   * Determine which provider to use for a given model
   */
  static getProviderNameForModel(model: string): 'claude' | 'cursor' {
    const lowerModel = model.toLowerCase();

    // Check for explicit cursor prefix
    if (lowerModel.startsWith('cursor-')) {
      return 'cursor';
    }

    // Check if it's a known Cursor model ID
    const cursorModelId = lowerModel.replace('cursor-', '');
    if (cursorModelId in CURSOR_MODEL_MAP) {
      return 'cursor';
    }

    // Check for Cursor-specific patterns
    if (
      lowerModel === 'auto' ||
      lowerModel.includes('gpt-') ||
      lowerModel.includes('gemini-') ||
      lowerModel === 'o3-mini'
    ) {
      // These could be Cursor models, but we default to Claude
      // unless explicitly prefixed with cursor-
    }

    // Check for Claude model patterns
    if (
      lowerModel.startsWith('claude-') ||
      ['opus', 'sonnet', 'haiku'].some((n) => lowerModel.includes(n))
    ) {
      return 'claude';
    }

    // Default to Claude
    return 'claude';
  }

  /**
   * Get a provider instance for the given model
   */
  static getProviderForModel(model: string, config?: ProviderConfig): BaseProvider {
    const providerName = this.getProviderNameForModel(model);

    if (providerName === 'cursor') {
      return new CursorProvider(config);
    }

    return new ClaudeProvider(config);
  }

  /**
   * Get all registered providers
   */
  static getAllProviders(): BaseProvider[] {
    return [new ClaudeProvider(), new CursorProvider()];
  }

  /**
   * Get a provider by name
   */
  static getProviderByName(name: string): BaseProvider | null {
    const lowerName = name.toLowerCase();

    switch (lowerName) {
      case 'claude':
        return new ClaudeProvider();
      case 'cursor':
        return new CursorProvider();
      default:
        return null;
    }
  }

  /**
   * Check installation status of all providers
   */
  static async checkAllProviders(): Promise<Record<string, InstallationStatus>> {
    const providers = this.getAllProviders();
    const statuses: Record<string, InstallationStatus> = {};

    await Promise.all(
      providers.map(async (provider) => {
        const status = await provider.detectInstallation();
        statuses[provider.getName()] = status;
      })
    );

    return statuses;
  }

  /**
   * Get all available models from all providers
   */
  static getAllAvailableModels(): ModelDefinition[] {
    const providers = this.getAllProviders();
    return providers.flatMap((p) => p.getAvailableModels());
  }
}
```

### Task 3.2: Export CursorProvider

**Status:** `pending`

**File:** `apps/server/src/providers/index.ts`

Add export:

```typescript
export { CursorProvider, CursorErrorCode, CursorError } from './cursor-provider';
export { CursorConfigManager } from './cursor-config-manager';
```

---

## Verification

### Test 1: Model Routing

```typescript
import { ProviderFactory } from './apps/server/src/providers/provider-factory';

// Cursor models
console.assert(ProviderFactory.getProviderNameForModel('cursor-auto') === 'cursor');
console.assert(ProviderFactory.getProviderNameForModel('cursor-gpt-4o') === 'cursor');
console.assert(ProviderFactory.getProviderNameForModel('cursor-claude-sonnet-4') === 'cursor');

// Claude models (default)
console.assert(ProviderFactory.getProviderNameForModel('claude-sonnet-4') === 'claude');
console.assert(ProviderFactory.getProviderNameForModel('opus') === 'claude');
console.assert(ProviderFactory.getProviderNameForModel('sonnet') === 'claude');
console.assert(ProviderFactory.getProviderNameForModel('haiku') === 'claude');

// Unknown models default to Claude
console.assert(ProviderFactory.getProviderNameForModel('unknown-model') === 'claude');

console.log('All routing tests passed!');
```

### Test 2: Provider Instantiation

```typescript
import { ProviderFactory } from './apps/server/src/providers/provider-factory';

const cursorProvider = ProviderFactory.getProviderForModel('cursor-auto');
console.assert(cursorProvider.getName() === 'cursor');

const claudeProvider = ProviderFactory.getProviderForModel('sonnet');
console.assert(claudeProvider.getName() === 'claude');

console.log('Provider instantiation tests passed!');
```

### Test 3: All Providers Check

```typescript
import { ProviderFactory } from './apps/server/src/providers/provider-factory';

const statuses = await ProviderFactory.checkAllProviders();
console.log('Provider statuses:', statuses);
// Should have both 'claude' and 'cursor' keys

const allModels = ProviderFactory.getAllAvailableModels();
console.log('Total models:', allModels.length);
// Should include models from both providers
```

---

## Verification Checklist

Before marking this phase complete:

- [ ] ProviderFactory routes `cursor-*` models to CursorProvider
- [ ] ProviderFactory routes Claude models to ClaudeProvider
- [ ] `getAllProviders()` returns both providers
- [ ] `getProviderByName('cursor')` returns CursorProvider
- [ ] `checkAllProviders()` returns status for both providers
- [ ] `getAllAvailableModels()` includes Cursor models
- [ ] Existing Claude routing not broken

---

## Files Changed

| File                                            | Action | Description           |
| ----------------------------------------------- | ------ | --------------------- |
| `apps/server/src/providers/provider-factory.ts` | Modify | Add Cursor routing    |
| `apps/server/src/providers/index.ts`            | Modify | Export CursorProvider |

---

## Notes

- Model routing uses prefix matching for explicit `cursor-` models
- Unknown models default to Claude for backward compatibility
- The factory is stateless - new provider instances created per call
