export const DESIGN_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;

export const DIALOG_FORM_CONTENT_CLASS_NAME =
  'max-w-[var(--layout-dialog-form-max-width)]';

export const SETTINGS_CENTER_SHEET_CLASS_NAME =
  'w-full border-l border-border/60 p-0 sm:max-w-[var(--layout-settings-drawer-max-width)] sm:rounded-l-[1.75rem]';

export const READER_FEED_DRAWER_SHEET_CLASS_NAME =
  'w-[min(88vw,var(--layout-reader-feed-drawer-max-width))] max-w-none p-0';

export const READER_TABLET_ARTICLE_PANE_CLASS_NAME =
  'w-[min(var(--layout-reader-tablet-list-max-width),42vw)] min-w-[var(--layout-reader-tablet-list-min-width)] shrink-0 border-r border-border/70 bg-background/72 supports-[backdrop-filter]:bg-background/58';

export const READER_PANE_HOVER_BACKGROUND_CLASS_NAME =
  'hover:bg-[var(--reader-pane-hover)]';

export const TOP_MESSAGE_VIEWPORT_CLASS_NAME =
  'pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-2 sm:top-4 sm:px-4';

export const FROSTED_HEADER_CLASS_NAME =
  'border-b border-border/60 bg-[color-mix(in_oklab,var(--color-background)_82%,white_18%)] backdrop-blur-xl supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-background)_74%,white_26%)]';

export const FLOATING_SURFACE_CLASS_NAME =
  'border border-border/60 bg-[color-mix(in_oklab,var(--color-background)_84%,white_16%)] shadow-surface backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-background)_76%,white_24%)]';
