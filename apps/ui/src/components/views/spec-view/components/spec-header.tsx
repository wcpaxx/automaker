import { Button } from '@/components/ui/button';
import {
  HeaderActionsPanel,
  HeaderActionsPanelTrigger,
} from '@/components/ui/header-actions-panel';
import { Save, Sparkles, Loader2, FileText, AlertCircle } from 'lucide-react';
import { PHASE_LABELS } from '../constants';

interface SpecHeaderProps {
  projectPath: string;
  isRegenerating: boolean;
  isCreating: boolean;
  isGeneratingFeatures: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  currentPhase: string;
  errorMessage: string;
  onRegenerateClick: () => void;
  onSaveClick: () => void;
  showActionsPanel: boolean;
  onToggleActionsPanel: () => void;
}

export function SpecHeader({
  projectPath,
  isRegenerating,
  isCreating,
  isGeneratingFeatures,
  isSaving,
  hasChanges,
  currentPhase,
  errorMessage,
  onRegenerateClick,
  onSaveClick,
  showActionsPanel,
  onToggleActionsPanel,
}: SpecHeaderProps) {
  const isProcessing = isRegenerating || isCreating || isGeneratingFeatures;
  const phaseLabel = PHASE_LABELS[currentPhase] || currentPhase;

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-border bg-glass backdrop-blur-md">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold">App Specification</h1>
            <p className="text-sm text-muted-foreground">{projectPath}/.automaker/app_spec.txt</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status indicators - always visible */}
          {isProcessing && (
            <div className="hidden lg:flex items-center gap-3 px-6 py-3.5 rounded-xl bg-linear-to-r from-primary/15 to-primary/5 border border-primary/30 shadow-lg backdrop-blur-md">
              <div className="relative">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <div className="absolute inset-0 w-5 h-5 animate-ping text-primary/20" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-sm font-semibold text-primary leading-tight tracking-tight">
                  {isGeneratingFeatures
                    ? 'Generating Features'
                    : isCreating
                      ? 'Generating Specification'
                      : 'Regenerating Specification'}
                </span>
                {currentPhase && (
                  <span className="text-xs text-muted-foreground/90 leading-tight font-medium">
                    {phaseLabel}
                  </span>
                )}
              </div>
            </div>
          )}
          {/* Mobile processing indicator */}
          {isProcessing && (
            <div className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs font-medium text-primary">Processing...</span>
            </div>
          )}
          {errorMessage && (
            <div className="hidden lg:flex items-center gap-3 px-6 py-3.5 rounded-xl bg-linear-to-r from-destructive/15 to-destructive/5 border border-destructive/30 shadow-lg backdrop-blur-md">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-sm font-semibold text-destructive leading-tight tracking-tight">
                  Error
                </span>
                <span className="text-xs text-destructive/90 leading-tight font-medium">
                  {errorMessage}
                </span>
              </div>
            </div>
          )}
          {/* Mobile error indicator */}
          {errorMessage && (
            <div className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-xs font-medium text-destructive">Error</span>
            </div>
          )}
          {/* Desktop: show actions inline */}
          <div className="hidden lg:flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRegenerateClick}
              disabled={isProcessing}
              data-testid="regenerate-spec"
            >
              {isRegenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {isRegenerating ? 'Regenerating...' : 'Regenerate'}
            </Button>
            <Button
              size="sm"
              onClick={onSaveClick}
              disabled={!hasChanges || isSaving || isProcessing}
              data-testid="save-spec"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
            </Button>
          </div>
          {/* Tablet/Mobile: show trigger for actions panel */}
          <HeaderActionsPanelTrigger isOpen={showActionsPanel} onToggle={onToggleActionsPanel} />
        </div>
      </div>

      {/* Actions Panel (tablet/mobile) */}
      <HeaderActionsPanel
        isOpen={showActionsPanel}
        onClose={onToggleActionsPanel}
        title="Specification Actions"
      >
        {/* Status messages in panel */}
        {isProcessing && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium text-primary">
                {isGeneratingFeatures
                  ? 'Generating Features'
                  : isCreating
                    ? 'Generating Specification'
                    : 'Regenerating Specification'}
              </span>
              {currentPhase && <span className="text-xs text-muted-foreground">{phaseLabel}</span>}
            </div>
          </div>
        )}
        {errorMessage && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium text-destructive">Error</span>
              <span className="text-xs text-destructive/80">{errorMessage}</span>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onRegenerateClick}
          disabled={isProcessing}
          data-testid="regenerate-spec-mobile"
        >
          {isRegenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {isRegenerating ? 'Regenerating...' : 'Regenerate'}
        </Button>
        <Button
          className="w-full justify-start"
          onClick={onSaveClick}
          disabled={!hasChanges || isSaving || isProcessing}
          data-testid="save-spec-mobile"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
        </Button>
      </HeaderActionsPanel>
    </>
  );
}
