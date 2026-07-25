/**
 * Keyboard users' shortcut past the navigation. Visually hidden until focused,
 * which is the only way it can be both unobtrusive and reachable.
 *
 * Every layout that renders it must give its main region the matching id.
 */
export const MAIN_CONTENT_ID = "main-content";

export function SkipToContent() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:h-11 focus:items-center focus:rounded-[10px] focus:border focus:border-line-strong focus:bg-paper focus:px-4 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lifted"
    >
      Skip to content
    </a>
  );
}
