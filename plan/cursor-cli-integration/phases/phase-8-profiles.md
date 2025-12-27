# Phase 8: AI Profiles Integration

**Status:** `pending`
**Dependencies:** Phase 1 (Types), Phase 7 (Settings)
**Estimated Effort:** Medium (UI + types)

---

## Objective

Extend the AI Profiles system to support Cursor as a provider, with proper handling of Cursor's embedded thinking mode (via model ID) vs Claude's separate thinking level.

---

## Key Concept: Thinking Mode Handling

### Claude Approach

- Separate `thinkingLevel` property: `'none' | 'low' | 'medium' | 'high' | 'ultrathink'`
- Applied to any Claude model

### Cursor Approach

- Thinking is **embedded in the model ID**
- Examples: `claude-sonnet-4` (no thinking) vs `claude-sonnet-4-thinking` (with thinking)
- No separate thinking level selector needed for Cursor profiles

---

## Tasks

### Task 8.1: Update AIProfile Type

**Status:** `pending`

**File:** `libs/types/src/settings.ts`

Update the AIProfile interface:

```typescript
import { CursorModelId } from './cursor-models';

/**
 * AI Profile - saved configuration for different use cases
 */
export interface AIProfile {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  icon?: string;

  // Provider selection
  provider: ModelProvider; // 'claude' | 'cursor'

  // Claude-specific
  model?: AgentModel; // 'opus' | 'sonnet' | 'haiku'
  thinkingLevel?: ThinkingLevel; // 'none' | 'low' | 'medium' | 'high' | 'ultrathink'

  // Cursor-specific
  cursorModel?: CursorModelId; // 'auto' | 'claude-sonnet-4' | 'gpt-4o' | etc.
  // Note: For Cursor, thinking is in the model ID (e.g., 'claude-sonnet-4-thinking')
}

/**
 * Helper to determine if a profile uses thinking mode
 */
export function profileHasThinking(profile: AIProfile): boolean {
  if (profile.provider === 'claude') {
    return profile.thinkingLevel !== undefined && profile.thinkingLevel !== 'none';
  }

  if (profile.provider === 'cursor') {
    const model = profile.cursorModel || 'auto';
    return model.includes('thinking') || model === 'o3-mini';
  }

  return false;
}

/**
 * Get effective model string for execution
 */
export function getProfileModelString(profile: AIProfile): string {
  if (profile.provider === 'cursor') {
    return `cursor-${profile.cursorModel || 'auto'}`;
  }

  // Claude
  return profile.model || 'sonnet';
}
```

### Task 8.2: Update Profile Form Component

**Status:** `pending`

**File:** `apps/ui/src/components/views/profiles-view/components/profile-form.tsx`

Add Cursor-specific fields:

```tsx
import React, { useState } from 'react';
import { Bot, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AIProfile,
  AgentModel,
  ModelProvider,
  ThinkingLevel,
  CursorModelId,
  CURSOR_MODEL_MAP,
  cursorModelHasThinking,
} from '@automaker/types';

interface ProfileFormProps {
  profile: AIProfile;
  onSave: (profile: AIProfile) => void;
  onCancel: () => void;
}

export function ProfileForm({ profile, onSave, onCancel }: ProfileFormProps) {
  const [formData, setFormData] = useState<AIProfile>(profile);

  const handleProviderChange = (provider: ModelProvider) => {
    setFormData((prev) => ({
      ...prev,
      provider,
      // Reset provider-specific fields
      model: provider === 'claude' ? 'sonnet' : undefined,
      thinkingLevel: provider === 'claude' ? 'none' : undefined,
      cursorModel: provider === 'cursor' ? 'auto' : undefined,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name & Description */}
      <div className="space-y-4">
        <div>
          <Label>Profile Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="My Profile"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            placeholder="Describe when to use this profile..."
          />
        </div>
      </div>

      {/* Provider Selection */}
      <div className="space-y-2">
        <Label>AI Provider</Label>
        <Select value={formData.provider} onValueChange={handleProviderChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claude">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Claude (Anthropic)
              </div>
            </SelectItem>
            <SelectItem value="cursor">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Cursor CLI
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Claude-specific settings */}
      {formData.provider === 'claude' && (
        <>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={formData.model || 'sonnet'}
              onValueChange={(v) => setFormData((p) => ({ ...p, model: v as AgentModel }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="haiku">Haiku (Fast)</SelectItem>
                <SelectItem value="sonnet">Sonnet (Balanced)</SelectItem>
                <SelectItem value="opus">Opus (Powerful)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Thinking Level</Label>
            <Select
              value={formData.thinkingLevel || 'none'}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, thinkingLevel: v as ThinkingLevel }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="ultrathink">Ultra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Cursor-specific settings */}
      {formData.provider === 'cursor' && (
        <div className="space-y-2">
          <Label>Cursor Model</Label>
          <Select
            value={formData.cursorModel || 'auto'}
            onValueChange={(v) => setFormData((p) => ({ ...p, cursorModel: v as CursorModelId }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CURSOR_MODEL_MAP).map(([id, config]) => (
                <SelectItem key={id} value={id}>
                  <div className="flex items-center gap-2">
                    <span>{config.label}</span>
                    {config.hasThinking && (
                      <Badge variant="outline" className="text-xs">
                        Thinking
                      </Badge>
                    )}
                    <Badge
                      variant={config.tier === 'free' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {config.tier}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Info about thinking models */}
          {formData.cursorModel && cursorModelHasThinking(formData.cursorModel) && (
            <p className="text-xs text-muted-foreground mt-2">
              This model has built-in extended thinking capabilities.
            </p>
          )}
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Profile</Button>
      </div>
    </form>
  );
}
```

### Task 8.3: Update Profile Card Display

**Status:** `pending`

**File:** `apps/ui/src/components/views/profiles-view/components/profile-card.tsx`

Show provider-specific info:

```tsx
import React from 'react';
import { Bot, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AIProfile, CURSOR_MODEL_MAP, profileHasThinking } from '@automaker/types';

interface ProfileCardProps {
  profile: AIProfile;
  onEdit: (profile: AIProfile) => void;
  onDelete: (profile: AIProfile) => void;
}

export function ProfileCard({ profile, onEdit, onDelete }: ProfileCardProps) {
  const hasThinking = profileHasThinking(profile);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {profile.provider === 'cursor' ? (
              <Terminal className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            {profile.name}
          </CardTitle>
          {profile.isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
        </div>
        <CardDescription>{profile.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap gap-2">
          {/* Provider badge */}
          <Badge variant="outline" className="capitalize">
            {profile.provider}
          </Badge>

          {/* Model badge */}
          <Badge variant="outline">
            {profile.provider === 'cursor'
              ? CURSOR_MODEL_MAP[profile.cursorModel || 'auto']?.label || profile.cursorModel
              : profile.model}
          </Badge>

          {/* Thinking badge */}
          {hasThinking && <Badge variant="default">Thinking</Badge>}
        </div>
      </CardContent>

      {!profile.isBuiltIn && (
        <CardFooter className="pt-0">
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={() => onEdit(profile)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(profile)}>
              Delete
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
```

### Task 8.4: Add Default Cursor Profiles

**Status:** `pending`

**File:** `apps/ui/src/components/views/profiles-view/constants.ts`

Add built-in Cursor profiles:

```typescript
import { AIProfile } from '@automaker/types';

export const DEFAULT_PROFILES: AIProfile[] = [
  // Existing Claude profiles...
  {
    id: 'claude-default',
    name: 'Claude Default',
    description: 'Balanced Claude Sonnet model',
    provider: 'claude',
    model: 'sonnet',
    thinkingLevel: 'none',
    isBuiltIn: true,
    icon: 'bot',
  },
  // ... other Claude profiles

  // Cursor profiles
  {
    id: 'cursor-auto',
    name: 'Cursor Auto',
    description: 'Let Cursor choose the best model automatically',
    provider: 'cursor',
    cursorModel: 'auto',
    isBuiltIn: true,
    icon: 'terminal',
  },
  {
    id: 'cursor-fast',
    name: 'Cursor Fast',
    description: 'Quick responses with GPT-4o Mini',
    provider: 'cursor',
    cursorModel: 'gpt-4o-mini',
    isBuiltIn: true,
    icon: 'zap',
  },
  {
    id: 'cursor-thinking',
    name: 'Cursor Thinking',
    description: 'Claude Sonnet 4 with extended thinking for complex tasks',
    provider: 'cursor',
    cursorModel: 'claude-sonnet-4-thinking',
    isBuiltIn: true,
    icon: 'brain',
  },
];
```

### Task 8.5: Update Profile Validation

**Status:** `pending`

Add validation for profile data:

```typescript
import { AIProfile, CURSOR_MODEL_MAP } from '@automaker/types';

export function validateProfile(profile: AIProfile): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!profile.name?.trim()) {
    errors.push('Profile name is required');
  }

  if (!['claude', 'cursor'].includes(profile.provider)) {
    errors.push('Invalid provider');
  }

  if (profile.provider === 'claude') {
    if (!profile.model) {
      errors.push('Claude model is required');
    }
  }

  if (profile.provider === 'cursor') {
    if (profile.cursorModel && !(profile.cursorModel in CURSOR_MODEL_MAP)) {
      errors.push('Invalid Cursor model');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## Verification

### Test 1: Profile Creation with Cursor

1. Navigate to Profiles view
2. Click "Create Profile"
3. Select "Cursor CLI" as provider
4. Select a Cursor model
5. Save the profile
6. Verify it appears in the list with correct badges

### Test 2: Thinking Mode Detection

```typescript
import { profileHasThinking } from '@automaker/types';

// Claude with thinking
const claudeThinking: AIProfile = {
  id: '1',
  name: 'Test',
  description: '',
  provider: 'claude',
  model: 'sonnet',
  thinkingLevel: 'high',
  isBuiltIn: false,
};
console.assert(profileHasThinking(claudeThinking) === true);

// Claude without thinking
const claudeNoThinking: AIProfile = {
  id: '2',
  name: 'Test',
  description: '',
  provider: 'claude',
  model: 'sonnet',
  thinkingLevel: 'none',
  isBuiltIn: false,
};
console.assert(profileHasThinking(claudeNoThinking) === false);

// Cursor with thinking model
const cursorThinking: AIProfile = {
  id: '3',
  name: 'Test',
  description: '',
  provider: 'cursor',
  cursorModel: 'claude-sonnet-4-thinking',
  isBuiltIn: false,
};
console.assert(profileHasThinking(cursorThinking) === true);

// Cursor without thinking
const cursorNoThinking: AIProfile = {
  id: '4',
  name: 'Test',
  description: '',
  provider: 'cursor',
  cursorModel: 'gpt-4o',
  isBuiltIn: false,
};
console.assert(profileHasThinking(cursorNoThinking) === false);

console.log('All thinking detection tests passed!');
```

### Test 3: Provider Switching

1. Create a new profile
2. Select Claude as provider
3. Configure Claude options
4. Switch to Cursor
5. Verify Claude options are hidden
6. Verify Cursor options are shown
7. Previous selections should be cleared

### Test 4: Built-in Profiles

1. Navigate to Profiles view
2. Verify Cursor built-in profiles appear
3. Verify they cannot be edited/deleted
4. Verify they show correct badges

---

## Verification Checklist

Before marking this phase complete:

- [ ] AIProfile type extended with Cursor fields
- [ ] `profileHasThinking()` works for both providers
- [ ] Profile form shows provider selector
- [ ] Claude options shown only for Claude provider
- [ ] Cursor options shown only for Cursor provider
- [ ] Cursor models show thinking badge where applicable
- [ ] Built-in Cursor profiles added
- [ ] Profile cards display provider info
- [ ] Profile validation works
- [ ] Profiles persist correctly

---

## Files Changed

| File                                                                     | Action | Description                    |
| ------------------------------------------------------------------------ | ------ | ------------------------------ |
| `libs/types/src/settings.ts`                                             | Modify | Add Cursor fields to AIProfile |
| `apps/ui/src/components/views/profiles-view/components/profile-form.tsx` | Modify | Add Cursor UI                  |
| `apps/ui/src/components/views/profiles-view/components/profile-card.tsx` | Modify | Show provider info             |
| `apps/ui/src/components/views/profiles-view/constants.ts`                | Modify | Add Cursor profiles            |

---

## Design Notes

- Provider selection is the first choice in profile form
- Switching providers resets model-specific options
- Cursor thinking is determined by model ID, not separate field
- Built-in profiles provide good starting points
- Profile cards show provider icon and model badges
