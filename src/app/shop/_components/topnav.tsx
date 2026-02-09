import { getSiteSettings } from "~/server/kv";
import { getCategories } from "~/server/queries";
import { AnnouncementBar } from "./AnnouncementBar";
import { ShopNavClient } from "./ShopNavClient";

// Top navigation bar for the shop — async server component
// Fetches site settings (logo, announcement, about) + categories from DB
// Passes data as props to client components for interactivity
export const TopNav = async () => {
  // Parallel fetch: site settings for logo/announcement/about + categories for nav links
  const [settings, categories] = await Promise.all([
    getSiteSettings(),
    getCategories(),
  ]);

  // Fall back to /logo.png if no custom logo is configured
  const logoUrl = settings.logo.large.url ?? "/logo.png";

  return (
    <header>
      {/* Announcement bar — only renders when enabled with text */}
      <AnnouncementBar announcementBanner={settings.announcementBanner} />
      {/* Interactive nav bar — handles responsive states + mobile menu */}
      {/* aboutEnabled controls visibility of the About link in both desktop and mobile nav */}
      <ShopNavClient
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        logoUrl={logoUrl}
        aboutEnabled={settings.about.enabled}
      />
    </header>
  );
};
