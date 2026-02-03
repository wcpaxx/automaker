import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Router, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet } from '@/lib/api-fetch';
import type { CCRStatus } from '@automaker/types';

interface CCRSettingsProps {
  ccrEnabled: boolean;
  onCcrEnabledChange: (enabled: boolean) => void;
}

/**
 * CCRSettings Component
 *
 * UI controls for Claude Code Router (CCR) integration:
 * - Status indicator showing if CCR is installed and running
 * - Toggle switch to enable/disable CCR API routing
 */
export function CCRSettings({ ccrEnabled, onCcrEnabledChange }: CCRSettingsProps) {
  const [ccrStatus, setCcrStatus] = useState<CCRStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await apiGet<CCRStatus>('/api/settings/ccr/status');
        setCcrStatus(response);
      } catch (error) {
        setCcrStatus({ installed: false, running: false, error: 'Failed to check CCR status' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const getStatusDisplay = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Checking CCR status...</span>
        </div>
      );
    }

    if (!ccrStatus?.installed) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <XCircle className="w-4 h-4" />
          <span className="text-xs">CCR not installed</span>
        </div>
      );
    }

    if (!ccrStatus?.running) {
      return (
        <div className="flex items-center gap-2 text-amber-500">
          <XCircle className="w-4 h-4" />
          <span className="text-xs">
            CCR installed but not running (run{' '}
            <code className="px-1 py-0.5 rounded bg-accent/50">ccr start</code>)
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-emerald-500">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-xs">CCR running on port {ccrStatus.port}</span>
      </div>
    );
  };

  const canEnable = ccrStatus?.installed && ccrStatus?.running;

  // Logic: allow disabling even if CCR is down (to fix broken state),
  // but only allow enabling if CCR is actually running.
  const isSwitchDisabled = !ccrEnabled && !canEnable;

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'border border-border/50',
        'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
        'shadow-sm shadow-black/5'
      )}
      data-testid="ccr-settings"
    >
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-accent/5 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center border border-purple-500/20">
            <Router className="w-5 h-5 text-purple-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            Claude Code Router
          </h2>
        </div>
        <p className="text-sm text-muted-foreground/80 ml-12">
          Route API requests through CCR for model switching and cost optimization.
        </p>
      </div>
      <div className="p-6 space-y-4">
        {/* Status indicator */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          {getStatusDisplay()}
        </div>

        {/* Enable/Disable toggle */}
        <div className="group flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 transition-colors duration-200 -mx-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="ccr-enabled"
              className={cn(
                'text-foreground cursor-pointer font-medium flex items-center gap-2',
                isSwitchDisabled && 'opacity-50'
              )}
            >
              <Router className="w-4 h-4 text-purple-500" />
              Enable CCR Routing
            </Label>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              When enabled, all Claude API requests are routed through CCR proxy.
              {!ccrStatus?.installed && (
                <>
                  {' '}
                  <a
                    href="https://github.com/musistudio/claude-code-router"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
                  >
                    Install CCR
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </p>
          </div>
          <Switch
            id="ccr-enabled"
            checked={ccrEnabled}
            onCheckedChange={onCcrEnabledChange}
            disabled={isSwitchDisabled}
            data-testid="ccr-enabled-switch"
          />
        </div>
      </div>
    </div>
  );
}
