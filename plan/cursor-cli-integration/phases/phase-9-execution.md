# Phase 9: Task Execution Integration

**Status:** `pending`
**Dependencies:** Phase 3 (Factory), Phase 8 (Profiles)
**Estimated Effort:** Medium (service updates)

---

## Objective

Update the task execution flow (agent-service, auto-mode-service) to use the ProviderFactory for model routing, ensuring Cursor models are executed via CursorProvider.

---

## Tasks

### Task 9.1: Update Agent Service

**Status:** `pending`

**File:** `apps/server/src/services/agent-service.ts`

Update to use ProviderFactory:

```typescript
import { ProviderFactory } from '../providers/provider-factory';
import { getProfileModelString, profileHasThinking } from '@automaker/types';

export class AgentService {
  // ...existing code...

  /**
   * Execute a chat message using the appropriate provider
   */
  async executeChat(sessionId: string, message: string, options: ChatOptions = {}): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Determine effective model
    const profile = options.profile;
    let effectiveModel: string;

    if (profile) {
      effectiveModel = getProfileModelString(profile);
    } else {
      effectiveModel = options.model || session.model || 'sonnet';
    }

    // Get provider for this model
    const provider = ProviderFactory.getProviderForModel(effectiveModel, {
      cwd: session.workDir,
    });

    const providerName = provider.getName();
    this.logger.debug(`[AgentService] Using ${providerName} provider for model ${effectiveModel}`);

    // Build execution options
    const executeOptions: ExecuteOptions = {
      prompt: message,
      model: effectiveModel,
      cwd: session.workDir,
      systemPrompt: this.buildSystemPrompt(session, options),
      maxTurns: options.maxTurns || 100,
      allowedTools: options.allowedTools || TOOL_PRESETS.chat,
      abortController: session.abortController,
      conversationHistory: session.conversationHistory,
      sdkSessionId: session.sdkSessionId,
    };

    // Add thinking level for Claude
    if (providerName === 'claude' && profile?.thinkingLevel) {
      executeOptions.thinkingLevel = profile.thinkingLevel;
    }

    try {
      // Stream from provider
      const stream = provider.executeQuery(executeOptions);

      for await (const msg of stream) {
        // Capture session ID
        if (msg.session_id && !session.sdkSessionId) {
          session.sdkSessionId = msg.session_id;
        }

        // Process message and emit events
        this.processProviderMessage(sessionId, msg);
      }
    } catch (error) {
      this.handleProviderError(sessionId, error, providerName);
    }
  }

  /**
   * Process a provider message and emit appropriate events
   */
  private processProviderMessage(sessionId: string, msg: ProviderMessage): void {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text) {
          this.emitAgentEvent(sessionId, {
            type: 'stream',
            content: block.text,
          });
        } else if (block.type === 'tool_use') {
          this.emitAgentEvent(sessionId, {
            type: 'tool_use',
            tool: {
              name: block.name,
              input: block.input,
              id: block.tool_use_id,
            },
          });
        } else if (block.type === 'tool_result') {
          this.emitAgentEvent(sessionId, {
            type: 'tool_result',
            toolId: block.tool_use_id,
            content: block.content,
          });
        } else if (block.type === 'thinking' && block.thinking) {
          this.emitAgentEvent(sessionId, {
            type: 'thinking',
            content: block.thinking,
          });
        }
      }
    } else if (msg.type === 'result') {
      this.emitAgentEvent(sessionId, {
        type: 'complete',
        content: msg.result || '',
      });
    } else if (msg.type === 'error') {
      this.emitAgentEvent(sessionId, {
        type: 'error',
        error: msg.error || 'Unknown error',
      });
    }
  }

  /**
   * Handle provider-specific errors
   */
  private handleProviderError(sessionId: string, error: any, providerName: string): void {
    let errorMessage = error.message || 'Unknown error';
    let suggestion = error.suggestion;

    // Add provider context
    if (providerName === 'cursor' && error.code) {
      switch (error.code) {
        case 'CURSOR_NOT_AUTHENTICATED':
          suggestion = 'Run "cursor-agent login" in your terminal';
          break;
        case 'CURSOR_RATE_LIMITED':
          suggestion = 'Wait a few minutes or upgrade to Cursor Pro';
          break;
        case 'CURSOR_NOT_INSTALLED':
          suggestion = 'Install Cursor CLI: curl https://cursor.com/install -fsS | bash';
          break;
      }
    }

    this.emitAgentEvent(sessionId, {
      type: 'error',
      error: errorMessage,
      suggestion,
      provider: providerName,
    });

    this.logger.error(`[AgentService] ${providerName} error:`, error);
  }
}
```

### Task 9.2: Update Auto Mode Service

**Status:** `pending`

**File:** `apps/server/src/services/auto-mode-service.ts`

Update the `runAgent` method:

```typescript
import { ProviderFactory } from '../providers/provider-factory';
import { getProfileModelString } from '@automaker/types';

export class AutoModeService {
  // ...existing code...

  /**
   * Run the agent for a task
   */
  private async runAgent(task: Task, options: AutoModeOptions): Promise<AgentResult> {
    const { workDir, profile, maxTurns } = options;

    // Determine model from profile or task
    let model: string;
    if (profile) {
      model = getProfileModelString(profile);
    } else {
      model = task.model || 'sonnet';
    }

    // Get provider
    const provider = ProviderFactory.getProviderForModel(model, { cwd: workDir });
    const providerName = provider.getName();

    this.logger.info(`[AutoMode] Running with ${providerName} provider, model: ${model}`);

    // Build execution options
    const executeOptions: ExecuteOptions = {
      prompt: this.buildPrompt(task),
      model,
      cwd: workDir,
      systemPrompt: options.systemPrompt,
      maxTurns: maxTurns || MAX_TURNS.extended,
      allowedTools: options.allowedTools || TOOL_PRESETS.fullAccess,
      abortController: options.abortController,
    };

    let responseText = '';
    const toolCalls: ToolCall[] = [];

    try {
      const stream = provider.executeQuery(executeOptions);

      for await (const msg of stream) {
        // Emit progress events
        this.emitProgress(task.id, msg, providerName);

        // Collect response
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text') {
              responseText += block.text || '';
            } else if (block.type === 'tool_use') {
              toolCalls.push({
                id: block.tool_use_id,
                name: block.name,
                input: block.input,
              });
            }
          }
        }
      }

      return {
        success: true,
        response: responseText,
        toolCalls,
        provider: providerName,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: error.suggestion,
        provider: providerName,
      };
    }
  }

  /**
   * Emit progress event for UI updates
   */
  private emitProgress(taskId: string, msg: ProviderMessage, provider: string): void {
    // Emit event for log viewer and progress tracking
    this.events.emit('auto-mode:event', {
      taskId,
      provider,
      message: msg,
      timestamp: Date.now(),
    });
  }
}
```

### Task 9.3: Update Model Selector in Board View

**Status:** `pending`

**File:** `apps/ui/src/components/views/board-view/dialogs/add-feature-dialog.tsx`

Add Cursor models to selection:

```tsx
import { CURSOR_MODEL_MAP, CursorModelId } from '@automaker/types';

interface ModelOption {
  id: string;
  label: string;
  provider: 'claude' | 'cursor';
  hasThinking?: boolean;
}

const MODEL_OPTIONS: ModelOption[] = [
  // Claude models
  { id: 'haiku', label: 'Claude Haiku', provider: 'claude' },
  { id: 'sonnet', label: 'Claude Sonnet', provider: 'claude' },
  { id: 'opus', label: 'Claude Opus', provider: 'claude' },

  // Cursor models
  ...Object.entries(CURSOR_MODEL_MAP).map(([id, config]) => ({
    id: `cursor-${id}`,
    label: `Cursor: ${config.label}`,
    provider: 'cursor' as const,
    hasThinking: config.hasThinking,
  })),
];

// In the dialog form:
<div className="space-y-2">
  <Label>Model</Label>
  <Select value={selectedModel} onValueChange={setSelectedModel}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Claude</SelectLabel>
        {MODEL_OPTIONS.filter((m) => m.provider === 'claude').map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.label}
          </SelectItem>
        ))}
      </SelectGroup>
      <SelectGroup>
        <SelectLabel>Cursor</SelectLabel>
        {MODEL_OPTIONS.filter((m) => m.provider === 'cursor').map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <div className="flex items-center gap-2">
              {model.label}
              {model.hasThinking && (
                <Badge variant="outline" className="text-xs">
                  Thinking
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
</div>;
```

### Task 9.4: Update Feature Execution with Provider Tracking

**Status:** `pending`

Track which provider executed each feature for UI display:

```typescript
interface FeatureExecution {
  id: string;
  featureId: string;
  model: string;
  provider: 'claude' | 'cursor';
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

// Store provider info in execution results
const execution: FeatureExecution = {
  id: generateId(),
  featureId: feature.id,
  model: effectiveModel,
  provider: ProviderFactory.getProviderNameForModel(effectiveModel),
  startTime: Date.now(),
  status: 'running',
};
```

---

## Verification

### Test 1: Claude Model Execution

1. Create a task with a Claude model (e.g., `sonnet`)
2. Execute the task
3. Verify ClaudeProvider is used
4. Verify output streams correctly
5. Verify tool calls work

### Test 2: Cursor Model Execution

1. Create a task with a Cursor model (e.g., `cursor-auto`)
2. Execute the task
3. Verify CursorProvider is used
4. Verify output streams correctly
5. Verify tool calls work

### Test 3: Profile-Based Execution

1. Create a Cursor profile
2. Use that profile for a task
3. Verify correct provider is selected
4. Verify profile settings are applied

### Test 4: Error Handling

1. Use Cursor model without CLI installed
2. Verify appropriate error message
3. Verify suggestion is shown
4. Verify execution can be retried

### Test 5: Mixed Provider Session

1. Run a task with Claude
2. Run another task with Cursor
3. Verify both execute correctly
4. Verify logs show correct provider info

---

## Verification Checklist

Before marking this phase complete:

- [ ] AgentService uses ProviderFactory
- [ ] AutoModeService uses ProviderFactory
- [ ] Claude models route to ClaudeProvider
- [ ] Cursor models route to CursorProvider
- [ ] Profile model string conversion works
- [ ] Provider errors include suggestions
- [ ] Progress events include provider info
- [ ] Model selector includes Cursor models
- [ ] Execution results track provider
- [ ] Log viewer shows provider context

---

## Files Changed

| File                                                                     | Action | Description         |
| ------------------------------------------------------------------------ | ------ | ------------------- |
| `apps/server/src/services/agent-service.ts`                              | Modify | Use ProviderFactory |
| `apps/server/src/services/auto-mode-service.ts`                          | Modify | Use ProviderFactory |
| `apps/ui/src/components/views/board-view/dialogs/add-feature-dialog.tsx` | Modify | Add Cursor models   |

---

## Notes

- Provider selection happens at execution time, not configuration time
- Session state may span provider switches
- Error handling is provider-aware
- Progress events include provider for UI grouping
