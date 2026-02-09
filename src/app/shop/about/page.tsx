/**
 * Shop About Page
 * Server component that renders the public-facing About page
 * Returns 404 when the about page is disabled in settings
 */
import { notFound } from "next/navigation";
import Image from "next/image";
import { getSiteSettings } from "~/server/kv";

// Force dynamic to always read fresh settings from KV
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const settings = await getSiteSettings();

  // Return 404 when about page is disabled in admin settings
  if (!settings.about.enabled) {
    notFound();
  }

  const { title, content, images } = settings.about;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page title */}
      {title && (
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
      )}

      {/* Content — plain text with newlines rendered as separate paragraphs */}
      {content && (
        <div className="mb-8 space-y-4">
          {content.split("\n").map((paragraph, i) =>
            paragraph.trim() ? (
              <p key={i} className="text-base leading-relaxed text-gray-300">
                {paragraph}
              </p>
            ) : null
          )}
        </div>
      )}

      {/* Image gallery — 1 col mobile, 2 col sm+ for responsive layout */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {images.map((img) => (
            <div key={img.key} className="overflow-hidden rounded-lg">
              <Image
                src={img.url}
                alt={img.alt || "About image"}
                width={600}
                height={400}
                className="h-auto w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
