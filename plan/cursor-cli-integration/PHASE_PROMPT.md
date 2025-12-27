# Global Prompt for Cursor CLI Integration Phases

Copy the prompt below when starting a new Claude session for any phase.

---

## Prompt Template

```
I'm implementing the Cursor CLI integration for AutoMaker.

## Context
- Plan location: `P:\automaker\plan\cursor-cli-integration\`
- Read the README.md first for architecture overview and design decisions
- Then read the specific phase file I mention below

## Phase to Implement
[REPLACE THIS LINE WITH: Phase X - phases/phase-X-*.md]

## Critical Requirements

### 1. Use @automaker/* Packages (see docs\llm-shared-packages.md)

**From @automaker/types:**
- Reuse `InstallationStatus` (don't create new status types)
- Use `ModelProvider` type ('claude' | 'cursor')
- Use `CursorModelId`, `CURSOR_MODEL_MAP` for Cursor models

**From @automaker/utils:**
import { createLogger, isAbortError, mkdirSafe, existsSafe } from '@automaker/utils';

**From @automaker/platform:**
import { spawnJSONLProcess, getAutomakerDir } from '@automaker/platform';

### 2. UI Components (apps/ui)
All UI must use components from `@/components/ui/*`:
- Card, CardHeader, CardTitle, CardContent, CardFooter
- Button, Badge, Label, Input, Textarea
- Select, SelectContent, SelectItem, SelectTrigger, SelectValue
- Checkbox, Alert, AlertDescription
- Tabs, TabsList, TabsTrigger, TabsContent

Icons from `lucide-react`: Terminal (Cursor), Bot (Claude), CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink

### 3. API Requests (apps/ui)
Use HttpApiClient, NOT raw fetch():
import { api } from '@/lib/http-api-client';
const result = await api.setup.getCursorStatus();

### 4. Do NOT Extend @automaker/model-resolver
Cursor models use `CURSOR_MODEL_MAP` in @automaker/types instead.

## Instructions
1. Read the phase file completely
2. Implement each task in order
3. Run the verification steps before marking complete
4. Update the phase status in the markdown file when done
```

---

## Quick Reference: Phase Order

| Phase | File                             | Description                     |
| ----- | -------------------------------- | ------------------------------- |
| 0     | `phases/phase-0-analysis.md`     | Analysis & Documentation        |
| 1     | `phases/phase-1-types.md`        | Core Types & Configuration      |
| 2     | `phases/phase-2-provider.md`     | Cursor Provider Implementation  |
| 3     | `phases/phase-3-factory.md`      | Provider Factory Integration    |
| 4     | `phases/phase-4-routes.md`       | Setup Routes & Status Endpoints |
| 5     | `phases/phase-5-log-parser.md`   | Log Parser Integration          |
| 6     | `phases/phase-6-setup-wizard.md` | UI Setup Wizard                 |
| 7     | `phases/phase-7-settings.md`     | Settings View Provider Tabs     |
| 8     | `phases/phase-8-profiles.md`     | AI Profiles Integration         |
| 9     | `phases/phase-9-execution.md`    | Task Execution Integration      |
| 10    | `phases/phase-10-testing.md`     | Testing & Validation            |

## Dependencies

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 6
                                    ↘         ↘ Phase 7
                              Phase 5 → Phase 8 → Phase 9 → Phase 10
```

Phases 4-7 can run in parallel after Phase 3.
Phase 8 depends on Phase 1 and Phase 7.
Phase 9 depends on Phase 8.
Phase 10 is final integration testing.
