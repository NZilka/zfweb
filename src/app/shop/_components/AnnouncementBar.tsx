import type { SiteSettings } from "~/server/kv";

// Props: only the announcement banner slice of site settings
type AnnouncementBarProps = {
  announcementBanner: SiteSettings["announcementBanner"];
};

// Server component — renders a full-width announcement bar above the nav
// Supports static centered text or scrolling marquee animation
// Only renders when enabled and text is present
export function AnnouncementBar({ announcementBanner }: AnnouncementBarProps) {
  const { enabled, text, scrolling } = announcementBanner;

  // Don't render if disabled or no text configured
  if (!enabled || !text) return null;

  return (
    <div className="w-full border-b border-neutral-200 bg-neutral-100 py-1.5 text-center text-xs tracking-wide text-neutral-600">
      {scrolling ? (
        // Scrolling marquee — two copies of text for seamless looping
        // Window = 125% of text width; spacer between copies = text width
        // This creates a brief overlap: copy 2 enters the right edge just before
        // copy 1 fully exits the left edge, so text is always partially visible
        // Animate translateX(-50%) to loop since the two halves are identical
        <div
          className="mx-auto overflow-hidden whitespace-nowrap"
          style={{
            width: `${Math.ceil(text.length * 1.25)}ch`,
            maxWidth: "100%",
          }}
        >
          <span className="animate-marquee inline-block">
            {text}
            {/* Spacer = text width so overlap is brief (~12.5% of cycle) */}
            <span
              className="inline-block"
              style={{ width: `${text.length}ch` }}
              aria-hidden="true"
            />
            {text}
            <span
              className="inline-block"
              style={{ width: `${text.length}ch` }}
              aria-hidden="true"
            />
          </span>
        </div>
      ) : (
        // Static centered text
        <p className="px-4">{text}</p>
      )}
    </div>
  );
}
