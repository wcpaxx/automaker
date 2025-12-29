import { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Terminal, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getHttpApiClient } from '@/lib/http-api-client';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import type { CursorModelId, CursorModelConfig, CursorCliConfig } from '@automaker/types';
import { CURSOR_MODEL_MAP } from '@automaker/types';
import {
  CursorCliStatus,
  CursorCliStatusSkeleton,
  ModelConfigSkeleton,
} from '../cli-status/cursor-cli-status';

interface CursorStatus {
  installed: boolean;
  version?: string;
  authenticated: boolean;
  method?: string;
}

export function CursorSettingsTab() {
  const { currentProject } = useAppStore();
  const [status, setStatus] = useState<CursorStatus | null>(null);
  const [config, setConfig] = useState<CursorCliConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<CursorModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getHttpApiClient();
      const statusResult = await api.setup.getCursorStatus();

      if (statusResult.success) {
        setStatus({
          installed: statusResult.installed ?? false,
          version: statusResult.version ?? undefined,
          authenticated: statusResult.auth?.authenticated ?? false,
          method: statusResult.auth?.method,
        });
      }

      // Only load config if we have a project path
      if (currentProject?.path) {
        const configResult = await api.setup.getCursorConfig(currentProject.path);
        if (configResult.success) {
          setConfig({
            defaultModel: configResult.config?.defaultModel as CursorModelId | undefined,
            models: configResult.config?.models as CursorModelId[] | undefined,
            mcpServers: configResult.config?.mcpServers,
            rules: configResult.config?.rules,
          });
          if (configResult.availableModels) {
            setAvailableModels(configResult.availableModels as CursorModelConfig[]);
          } else {
            setAvailableModels(Object.values(CURSOR_MODEL_MAP));
          }
        } else {
          // Set defaults if no config
          setAvailableModels(Object.values(CURSOR_MODEL_MAP));
        }
      } else {
        // No project, just show available models
        setAvailableModels(Object.values(CURSOR_MODEL_MAP));
      }
    } catch (error) {
      console.error('Failed to load Cursor settings:', error);
      toast.error('Failed to load Cursor settings');
    } finally {
      setIsLoading(false);
    }
  }, [currentProject?.path]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDefaultModelChange = async (model: CursorModelId) => {
    if (!currentProject?.path) {
      toast.error('No project selected');
      return;
    }

    setIsSaving(true);
    try {
      const api = getHttpApiClient();
      const result = await api.setup.setCursorDefaultModel(currentProject.path, model);

      if (result.success) {
        setConfig((prev) => (prev ? { ...prev, defaultModel: model } : { defaultModel: model }));
        toast.success('Default model updated');
      } else {
        toast.error(result.error || 'Failed to update default model');
      }
    } catch (error) {
      toast.error('Failed to update default model');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModelToggle = async (model: CursorModelId, enabled: boolean) => {
    if (!currentProject?.path) {
      toast.error('No project selected');
      return;
    }

    const currentModels = config?.models || ['auto'];
    const newModels = enabled
      ? [...currentModels, model]
      : currentModels.filter((m) => m !== model);

    setIsSaving(true);
    try {
      const api = getHttpApiClient();
      const result = await api.setup.setCursorModels(currentProject.path, newModels);

      if (result.success) {
        setConfig((prev) => (prev ? { ...prev, models: newModels } : { models: newModels }));
      } else {
        toast.error(result.error || 'Failed to update models');
      }
    } catch (error) {
      toast.error('Failed to update models');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Usage Info skeleton */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-400/90">
            <span className="font-medium">Board View Only</span>
            <p className="text-xs text-amber-400/70 mt-1">
              Cursor is currently only available for the Kanban board agent tasks.
            </p>
          </div>
        </div>
        <CursorCliStatusSkeleton />
        <ModelConfigSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Usage Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-400/90">
          <span className="font-medium">Board View Only</span>
          <p className="text-xs text-amber-400/70 mt-1">
            Cursor is currently only available for the Kanban board agent tasks.
          </p>
        </div>
      </div>

      {/* CLI Status */}
      <CursorCliStatus status={status} isChecking={isLoading} onRefresh={loadData} />

      {/* Model Configuration */}
      {status?.installed && currentProject && (
        <div
          className={cn(
            'rounded-2xl overflow-hidden',
            'border border-border/50',
            'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
            'shadow-sm shadow-black/5'
          )}
        >
          <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-accent/5 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 flex items-center justify-center border border-brand-500/20">
                <Terminal className="w-5 h-5 text-brand-500" />
              </div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Model Configuration
              </h2>
            </div>
            <p className="text-sm text-muted-foreground/80 ml-12">
              Configure which Cursor models are available and set the default
            </p>
          </div>
          <div className="p-6 space-y-6">
            {/* Default Model */}
            <div className="space-y-2">
              <Label>Default Model</Label>
              <Select
                value={config?.defaultModel || 'auto'}
                onValueChange={(v) => handleDefaultModelChange(v as CursorModelId)}
                disabled={isSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(config?.models || ['auto']).map((modelId) => {
                    const model = CURSOR_MODEL_MAP[modelId as CursorModelId];
                    if (!model) return null;
                    return (
                      <SelectItem key={modelId} value={modelId}>
                        <div className="flex items-center gap-2">
                          <span>{model.label}</span>
                          {model.hasThinking && (
                            <Badge variant="outline" className="text-xs">
                              Thinking
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Enabled Models */}
            <div className="space-y-3">
              <Label>Available Models</Label>
              <div className="grid gap-3">
                {availableModels.map((model) => {
                  const isEnabled = config?.models?.includes(model.id) ?? model.id === 'auto';
                  const isAuto = model.id === 'auto';

                  return (
                    <div
                      key={model.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleModelToggle(model.id, !!checked)}
                          disabled={isSaving || isAuto}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{model.label}</span>
                            {model.hasThinking && (
                              <Badge variant="outline" className="text-xs">
                                Thinking
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{model.description}</p>
                        </div>
                      </div>
                      <Badge variant={model.tier === 'free' ? 'default' : 'secondary'}>
                        {model.tier}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Project Selected */}
      {status?.installed && !currentProject && (
        <div
          className={cn(
            'rounded-2xl overflow-hidden',
            'border border-border/50',
            'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
            'shadow-sm shadow-black/5'
          )}
        >
          <div className="p-8 text-center text-muted-foreground">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500/10 to-brand-600/5 flex items-center justify-center border border-brand-500/10 mx-auto mb-4">
              <Terminal className="w-6 h-6 text-brand-500/50" />
            </div>
            <p className="font-medium">No project selected</p>
            <p className="text-sm mt-2">Select a project to configure Cursor models.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default CursorSettingsTab;
