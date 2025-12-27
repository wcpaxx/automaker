# Phase 0: Analysis & Documentation

**Status:** `pending`
**Dependencies:** None
**Estimated Effort:** Research only (no code changes)

---

## Objective

Understand existing AutoMaker architecture patterns before writing any code. Document findings to ensure consistent implementation.

---

## Tasks

### Task 0.1: Read Core Provider Files

**Status:** `pending`

Read and understand these files:

| File                                            | Purpose                  | Key Patterns                            |
| ----------------------------------------------- | ------------------------ | --------------------------------------- |
| `apps/server/src/providers/base-provider.ts`    | Abstract base class      | `executeQuery()` AsyncGenerator pattern |
| `apps/server/src/providers/claude-provider.ts`  | Reference implementation | SDK integration, streaming              |
| `apps/server/src/providers/provider-factory.ts` | Model routing            | `getProviderForModel()` pattern         |
| `apps/server/src/providers/types.ts`            | Type definitions         | `ProviderMessage`, `ExecuteOptions`     |

**Verification:**

```bash
# Files should exist and be readable
cat apps/server/src/providers/base-provider.ts | head -50
cat apps/server/src/providers/claude-provider.ts | head -100
```

### Task 0.2: Read Service Integration

**Status:** `pending`

Understand how providers are consumed:

| File                                            | Purpose               | Key Patterns                       |
| ----------------------------------------------- | --------------------- | ---------------------------------- |
| `apps/server/src/services/agent-service.ts`     | Chat sessions         | Provider streaming, event emission |
| `apps/server/src/services/auto-mode-service.ts` | Autonomous tasks      | executeOptions, tool handling      |
| `apps/server/src/lib/sdk-options.ts`            | Configuration factory | Tool presets, max turns            |

### Task 0.3: Read UI Streaming/Logging

**Status:** `pending`

Understand log parsing and display:

| File                                       | Purpose            | Key Patterns                 |
| ------------------------------------------ | ------------------ | ---------------------------- |
| `apps/ui/src/lib/log-parser.ts`            | Parse agent output | Entry types, tool categories |
| `apps/ui/src/components/ui/log-viewer.tsx` | Display logs       | Collapsible entries, search  |

### Task 0.4: Read Setup Flow

**Status:** `pending`

Understand setup wizard patterns:

| File                                                | Purpose            | Key Patterns             |
| --------------------------------------------------- | ------------------ | ------------------------ |
| `apps/server/src/routes/setup/index.ts`             | Route registration | Handler patterns         |
| `apps/server/src/routes/setup/get-claude-status.ts` | CLI detection      | Installation check logic |
| `apps/ui/src/components/views/setup-view.tsx`       | Wizard UI          | Step components          |

### Task 0.5: Read Types Package

**Status:** `pending`

Understand type definitions:

| File                              | Purpose        | Key Patterns                 |
| --------------------------------- | -------------- | ---------------------------- |
| `libs/types/src/index.ts`         | Re-exports     | Export patterns              |
| `libs/types/src/settings.ts`      | Settings types | `AIProfile`, `ModelProvider` |
| `libs/types/src/model.ts`         | Model aliases  | `CLAUDE_MODEL_MAP`           |
| `libs/types/src/model-display.ts` | UI metadata    | Display info pattern         |

### Task 0.6: Document Cursor CLI Behavior

**Status:** `pending`

Test and document Cursor CLI behavior:

```bash
# Check installation
cursor-agent --version

# Check auth status (if available)
cursor-agent status 2>&1 || echo "No status command"

# Test stream-json output (dry run)
echo "Test prompt" | cursor-agent -p --output-format stream-json --model auto 2>&1 | head -20
```

Document:

- [ ] Exact event sequence for simple prompt
- [ ] Error message formats
- [ ] Exit codes for different failure modes
- [ ] How tool calls appear in stream

---

## Deliverable: Analysis Document

Create `docs/cursor-integration-analysis.md` with findings:

```markdown
# Cursor CLI Integration Analysis

## Provider Pattern Summary

### BaseProvider Interface

- `executeQuery()` returns `AsyncGenerator<ProviderMessage>`
- Messages must match format: { type, message?, result?, error? }
- Session IDs propagated through all messages

### ClaudeProvider Patterns

- Uses Claude Agent SDK `query()` function
- Streaming handled natively by SDK
- Yields messages directly from SDK stream

### Key Interfaces

[Document: ProviderMessage, ExecuteOptions, InstallationStatus]

## Cursor CLI Behavior

### Stream Event Sequence

1. system/init - session start
2. user - input prompt
3. assistant - response text
4. tool_call/started - tool invocation
5. tool_call/completed - tool result
6. result/success - final output

### Event Format Differences

[Document any transformations needed]

### Error Scenarios

- Not authenticated: [error message/code]
- Rate limited: [error message/code]
- Network error: [error message/code]

## Integration Points

### Files to Create

[List with descriptions]

### Files to Modify

[List with specific changes needed]

## Open Questions

[Any unresolved issues]
```

---

## Verification Checklist

Before marking this phase complete:

- [ ] All provider files read and understood
- [ ] Service integration patterns documented
- [ ] Log parser patterns understood
- [ ] Setup wizard flow mapped
- [ ] Types package structure documented
- [ ] Cursor CLI behavior tested (if installed)
- [ ] Analysis document created in `docs/`

---

## Notes

- This phase is **read-only** - no code changes
- Document anything unclear for later clarification
- Note any differences from the high-level plan provided

---

## References

- [Cursor CLI Output Format](https://cursor.com/docs/cli/reference/output-format)
- [Cursor CLI Usage](https://cursor.com/docs/cli/using)
- [Cursor CLI GitHub Actions](https://cursor.com/docs/cli/github-actions)
