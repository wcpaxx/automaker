export type ViewMode =
  | 'welcome'
  | 'setup'
  | 'spec'
  | 'board'
  | 'agent'
  | 'settings'
  | 'interview'
  | 'context'
  | 'running-agents'
  | 'terminal'
  | 'wiki'
  | 'ideation';

export type ThemeMode =
  // Special modes
  | 'system'
  // Dark themes
  | 'dark'
  | 'retro'
  | 'dracula'
  | 'nord'
  | 'monokai'
  | 'tokyonight'
  | 'solarized'
  | 'gruvbox'
  | 'catppuccin'
  | 'onedark'
  | 'synthwave'
  | 'red'
  | 'sunset'
  | 'gray'
  | 'forest'
  | 'ocean'
  | 'ember'
  | 'ayu-dark'
  | 'ayu-mirage'
  | 'matcha'
  // Light themes
  | 'light'
  | 'cream'
  | 'solarizedlight'
  | 'github'
  | 'paper'
  | 'rose'
  | 'mint'
  | 'lavender'
  | 'sand'
  | 'sky'
  | 'peach'
  | 'snow'
  | 'sepia'
  | 'gruvboxlight'
  | 'nordlight'
  | 'blossom'
  | 'ayu-light'
  | 'onelight'
  | 'bluloco'
  | 'feather';

export type BoardViewMode = 'kanban' | 'graph';

// Keyboard Shortcut with optional modifiers
export interface ShortcutKey {
  key: string; // The main key (e.g., "K", "N", "1")
  shift?: boolean; // Shift key modifier
  cmdCtrl?: boolean; // Cmd on Mac, Ctrl on Windows/Linux
  alt?: boolean; // Alt/Option key modifier
}

// Helper to parse shortcut string to ShortcutKey object
export function parseShortcut(shortcut: string | undefined | null): ShortcutKey {
  if (!shortcut) return { key: '' };
  const parts = shortcut.split('+').map((p) => p.trim());
  const result: ShortcutKey = { key: parts[parts.length - 1] };

  // Normalize common OS-specific modifiers (Cmd/Ctrl/Win/Super symbols) into cmdCtrl
  for (let i = 0; i < parts.length - 1; i++) {
    const modifier = parts[i].toLowerCase();
    if (modifier === 'shift') result.shift = true;
    else if (
      modifier === 'cmd' ||
      modifier === 'ctrl' ||
      modifier === 'win' ||
      modifier === 'super' ||
      modifier === '⌘' ||
      modifier === '^' ||
      modifier === '⊞' ||
      modifier === '◆'
    )
      result.cmdCtrl = true;
    else if (modifier === 'alt' || modifier === 'opt' || modifier === 'option' || modifier === '⌥')
      result.alt = true;
  }

  return result;
}

// Helper to format ShortcutKey to display string
export function formatShortcut(shortcut: string | undefined | null, forDisplay = false): string {
  if (!shortcut) return '';
  const parsed = parseShortcut(shortcut);
  const parts: string[] = [];

  // Prefer User-Agent Client Hints when available; fall back to legacy
  const platform: 'darwin' | 'win32' | 'linux' = (() => {
    if (typeof navigator === 'undefined') return 'linux';

    const uaPlatform = (
      navigator as Navigator & { userAgentData?: { platform?: string } }
    ).userAgentData?.platform?.toLowerCase?.();
    const legacyPlatform = navigator.platform?.toLowerCase?.();
    const platformString = uaPlatform || legacyPlatform || '';

    if (platformString.includes('mac')) return 'darwin';
    if (platformString.includes('win')) return 'win32';
    return 'linux';
  })();

  // Primary modifier - OS-specific
  if (parsed.cmdCtrl) {
    if (forDisplay) {
      parts.push(platform === 'darwin' ? '⌘' : platform === 'win32' ? '⊞' : '◆');
    } else {
      parts.push(platform === 'darwin' ? 'Cmd' : platform === 'win32' ? 'Win' : 'Super');
    }
  }

  // Alt/Option
  if (parsed.alt) {
    parts.push(
      forDisplay ? (platform === 'darwin' ? '⌥' : 'Alt') : platform === 'darwin' ? 'Opt' : 'Alt'
    );
  }

  // Shift
  if (parsed.shift) {
    parts.push(forDisplay ? '⇧' : 'Shift');
  }

  parts.push(parsed.key.toUpperCase());

  // Add spacing when displaying symbols
  return parts.join(forDisplay ? ' ' : '+');
}

// Keyboard Shortcuts - stored as strings like "K", "Shift+N", "Cmd+K"
export interface KeyboardShortcuts {
  // Navigation shortcuts
  board: string;
  graph: string;
  agent: string;
  spec: string;
  context: string;
  memory: string;
  settings: string;
  projectSettings: string;
  terminal: string;
  ideation: string;
  notifications: string;
  githubIssues: string;
  githubPrs: string;

  // UI shortcuts
  toggleSidebar: string;

  // Action shortcuts
  addFeature: string;
  addContextFile: string;
  startNext: string;
  newSession: string;
  openProject: string;
  projectPicker: string;
  cyclePrevProject: string;
  cycleNextProject: string;

  // Terminal shortcuts
  splitTerminalRight: string;
  splitTerminalDown: string;
  closeTerminal: string;
  newTerminalTab: string;
}

// Default keyboard shortcuts
export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  // Navigation
  board: 'K',
  graph: 'H',
  agent: 'A',
  spec: 'D',
  context: 'C',
  memory: 'Y',
  settings: 'S',
  projectSettings: 'Shift+S',
  terminal: 'T',
  ideation: 'I',
  notifications: 'X',
  githubIssues: 'G',
  githubPrs: 'R',

  // UI
  toggleSidebar: '`',

  // Actions
  // Note: Some shortcuts share the same key (e.g., "N" for addFeature, newSession)
  // This is intentional as they are context-specific and only active in their respective views
  addFeature: 'N', // Only active in board view
  addContextFile: 'N', // Only active in context view
  startNext: 'G', // Only active in board view
  newSession: 'N', // Only active in agent view
  openProject: 'O', // Global shortcut
  projectPicker: 'P', // Global shortcut
  cyclePrevProject: 'Q', // Global shortcut
  cycleNextProject: 'E', // Global shortcut

  // Terminal shortcuts (only active in terminal view)
  // Using Alt modifier to avoid conflicts with both terminal signals AND browser shortcuts
  splitTerminalRight: 'Alt+D',
  splitTerminalDown: 'Alt+S',
  closeTerminal: 'Alt+W',
  newTerminalTab: 'Alt+T',
};
