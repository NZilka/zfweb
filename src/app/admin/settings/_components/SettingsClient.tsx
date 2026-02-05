/**
 * SettingsClient - Admin settings form
 * Handles maintenance mode and announcement banner configuration
 */
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { AlertTriangle, Megaphone, ImageIcon, Film, X, Upload, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { useUploadThing } from "~/utils/uploadthing";
import { updateSettings } from "~/server/settings-actions";
import type { SiteSettings, CarouselItem } from "~/server/kv";

interface SettingsClientProps {
  initialSettings: SiteSettings;
  kvAvailable: boolean;
}

// Default message shown when no custom message is set
const DEFAULT_MAINTENANCE_MESSAGE =
  "We're currently performing scheduled maintenance. Please check back soon!";

export function SettingsClient({ initialSettings, kvAvailable }: SettingsClientProps) {
  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(
    initialSettings.maintenanceMode.enabled
  );
  // Prepopulate with default message if none saved
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    initialSettings.maintenanceMode.message ?? DEFAULT_MAINTENANCE_MESSAGE
  );
  const [maintenanceImageUrl, setMaintenanceImageUrl] = useState(
    initialSettings.maintenanceMode.imageUrl ?? ""
  );
  const [maintenanceImageKey, setMaintenanceImageKey] = useState(
    initialSettings.maintenanceMode.imageKey ?? ""
  );

  // Announcement banner state
  const [announcementEnabled, setAnnouncementEnabled] = useState(
    initialSettings.announcementBanner.enabled
  );
  const [announcementText, setAnnouncementText] = useState(
    initialSettings.announcementBanner.text ?? ""
  );
  const [announcementScrolling, setAnnouncementScrolling] = useState(
    initialSettings.announcementBanner.scrolling
  );

  // Logo state — large and small variants with url + UploadThing key
  const [logoLargeUrl, setLogoLargeUrl] = useState(
    initialSettings.logo.large.url ?? ""
  );
  const [logoLargeKey, setLogoLargeKey] = useState(
    initialSettings.logo.large.key ?? ""
  );
  const [logoSmallUrl, setLogoSmallUrl] = useState(
    initialSettings.logo.small.url ?? ""
  );
  const [logoSmallKey, setLogoSmallKey] = useState(
    initialSettings.logo.small.key ?? ""
  );
  // Tracks which logo variant ("large" | "small") is currently being uploaded
  const [logoUploadTarget, setLogoUploadTarget] = useState<"large" | "small">("large");

  // Carousel state — enabled toggle, media items list, auto-scroll interval
  const [carouselEnabled, setCarouselEnabled] = useState(
    initialSettings.carousel.enabled
  );
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>(
    initialSettings.carousel.items
  );
  const [carouselInterval, setCarouselInterval] = useState(
    initialSettings.carousel.autoScrollInterval / 1000 // Convert ms to seconds for UI
  );

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [isCarouselUploading, setIsCarouselUploading] = useState(false);

  // File input refs for triggering file pickers
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const carouselFileInputRef = useRef<HTMLInputElement>(null);

  // UploadThing hook - same approach as product forms
  const { startUpload } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        setMaintenanceImageUrl(res[0].url);
        setMaintenanceImageKey(res[0].key);
        toast.success("Image uploaded");
      }
      setIsUploading(false);
    },
    onUploadError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    },
  });

  // UploadThing hook for logo uploads — routes to logoUploader endpoint
  const { startUpload: startLogoUpload } = useUploadThing("logoUploader", {
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        // Set the correct variant based on which upload was triggered
        if (logoUploadTarget === "large") {
          setLogoLargeUrl(res[0].url);
          setLogoLargeKey(res[0].key);
        } else {
          setLogoSmallUrl(res[0].url);
          setLogoSmallKey(res[0].key);
        }
        toast.success(`${logoUploadTarget === "large" ? "Large" : "Small"} logo uploaded`);
      }
      setIsLogoUploading(false);
    },
    onUploadError: (error) => {
      toast.error(`Logo upload failed: ${error.message}`);
      setIsLogoUploading(false);
    },
  });

  // Handle logo file selection — validates size and triggers upload
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      toast.error("Logo must be less than 4MB");
      return;
    }

    setIsLogoUploading(true);
    await startLogoUpload([file]);
    e.target.value = "";
  };

  // Handle file selection from input (maintenance image)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (4MB limit for maintenance image)
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be less than 4MB");
      return;
    }

    setIsUploading(true);
    await startUpload([file]);

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  // Derived state: check if maintenance settings are valid
  // Message is required when enabling maintenance mode
  const isMaintenanceValid =
    !maintenanceEnabled || maintenanceMessage.trim().length > 0;

  // Save maintenance mode settings
  const handleSaveMaintenanceMode = async () => {
    // Client-side validation: require message when enabling
    if (maintenanceEnabled && !maintenanceMessage.trim()) {
      toast.error("A maintenance message is required when enabling maintenance mode");
      return;
    }

    setIsSaving(true);
    const result = await updateSettings({
      maintenanceMode: {
        enabled: maintenanceEnabled,
        message: maintenanceMessage || null,
        imageUrl: maintenanceImageUrl || null,
        imageKey: maintenanceImageKey || null,
      },
    });

    if (result.success) {
      toast.success("Maintenance mode settings saved");
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  };

  // Save announcement banner settings
  const handleSaveAnnouncementBanner = async () => {
    setIsSaving(true);
    const result = await updateSettings({
      announcementBanner: {
        enabled: announcementEnabled,
        text: announcementText || null,
        scrolling: announcementScrolling,
      },
    });

    if (result.success) {
      toast.success("Announcement banner settings saved");
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  };

  // Remove maintenance image
  const handleRemoveImage = () => {
    setMaintenanceImageUrl("");
    setMaintenanceImageKey("");
  };

  // Save logo settings — persists both large and small variants
  const handleSaveLogoSettings = async () => {
    setIsSaving(true);
    const result = await updateSettings({
      logo: {
        large: {
          url: logoLargeUrl || null,
          key: logoLargeKey || null,
        },
        small: {
          url: logoSmallUrl || null,
          key: logoSmallKey || null,
        },
      },
    });

    if (result.success) {
      toast.success("Logo settings saved");
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  };

  // Remove a logo variant (large or small)
  const handleRemoveLogo = (variant: "large" | "small") => {
    if (variant === "large") {
      setLogoLargeUrl("");
      setLogoLargeKey("");
    } else {
      setLogoSmallUrl("");
      setLogoSmallKey("");
    }
  };

  // Trigger logo file picker for a specific variant
  const triggerLogoUpload = (variant: "large" | "small") => {
    setLogoUploadTarget(variant);
    logoFileInputRef.current?.click();
  };

  // UploadThing hook for carousel media — supports images and videos
  const { startUpload: startCarouselUpload } = useUploadThing("carouselMediaUploader", {
    onClientUploadComplete: (res) => {
      if (res) {
        // Append new items with incremental order values
        const maxOrder = carouselItems.length > 0
          ? Math.max(...carouselItems.map((i) => i.order))
          : -1;
        const newItems: CarouselItem[] = res.map((file, idx) => ({
          // Determine type from file content type (UploadThing returns type info in name)
          type: file.name.match(/\.(mp4|webm|mov|avi)$/i) ? "video" as const : "image" as const,
          url: file.url,
          key: file.key,
          order: maxOrder + 1 + idx,
        }));
        setCarouselItems((prev) => [...prev, ...newItems]);
        toast.success(`${res.length} file(s) uploaded`);
      }
      setIsCarouselUploading(false);
    },
    onUploadError: (error) => {
      toast.error(`Carousel upload failed: ${error.message}`);
      setIsCarouselUploading(false);
    },
  });

  // Handle carousel file selection — accepts images and videos
  const handleCarouselFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCarouselUploading(true);
    await startCarouselUpload(Array.from(files));
    e.target.value = "";
  };

  // Remove a carousel item by its key
  const handleRemoveCarouselItem = (key: string) => {
    setCarouselItems((prev) => prev.filter((item) => item.key !== key));
  };

  // Move a carousel item up or down in order
  const handleReorderCarouselItem = (key: string, direction: "up" | "down") => {
    setCarouselItems((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((item) => item.key === key);
      if (idx === -1) return prev;
      // Can't move first item up or last item down
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === sorted.length - 1) return prev;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      // Swap order values between the two items
      const temp = sorted[idx]!.order;
      sorted[idx]!.order = sorted[swapIdx]!.order;
      sorted[swapIdx]!.order = temp;
      return sorted;
    });
  };

  // Save carousel settings
  const handleSaveCarouselSettings = async () => {
    setIsSaving(true);
    const result = await updateSettings({
      carousel: {
        enabled: carouselEnabled,
        items: carouselItems,
        autoScrollInterval: carouselInterval * 1000, // Convert seconds to ms
      },
    });

    if (result.success) {
      toast.success("Carousel settings saved");
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  };

  // Show warning if KV is not configured
  if (!kvAvailable) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Card className="border-yellow-500 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Configuration Required
            </CardTitle>
            <CardDescription className="text-yellow-700">
              Settings storage is not configured. Please set up Upstash KV by adding
              UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Maintenance Mode Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Maintenance Mode
          </CardTitle>
          <CardDescription>
            When enabled, visitors will see a maintenance page instead of the site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="maintenance-toggle" className="flex flex-col gap-1">
              <span>Enable Maintenance Mode</span>
              <span className="text-sm font-normal text-gray-500">
                Site will be unavailable to visitors
              </span>
            </Label>
            <Switch
              id="maintenance-toggle"
              checked={maintenanceEnabled}
              onCheckedChange={setMaintenanceEnabled}
            />
          </div>

          {/* Maintenance message - required when enabled */}
          <div className="space-y-2">
            <Label htmlFor="maintenance-message">
              Maintenance Message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="maintenance-message"
              placeholder="We're currently performing scheduled maintenance. Please check back soon!"
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-gray-500">
              {maintenanceMessage.length}/1000 characters
              {/* Show requirement warning when toggle is on but message empty */}
              {maintenanceEnabled && !maintenanceMessage.trim() && (
                <span className="ml-2 text-red-500">
                  — Message required to enable maintenance mode
                </span>
              )}
            </p>
          </div>

          {/* Maintenance image */}
          <div className="space-y-2">
            <Label>Maintenance Image (Optional)</Label>
            {maintenanceImageUrl ? (
              <div className="relative inline-block">
                <Image
                  src={maintenanceImageUrl}
                  alt="Maintenance page image"
                  width={300}
                  height={200}
                  className="rounded-lg border object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              // Custom upload UI using useUploadThing hook
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 hover:border-gray-400">
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                <p className="mb-2 text-sm text-gray-600">
                  Upload a maintenance image
                </p>
                <p className="mb-4 text-xs text-gray-400">
                  PNG, JPG, GIF up to 4MB
                </p>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Choose File"
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Preview when enabled */}
          {maintenanceEnabled && (maintenanceMessage || maintenanceImageUrl) && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="mb-2 text-sm font-medium text-gray-500">Preview:</p>
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                {maintenanceImageUrl && (
                  <Image
                    src={maintenanceImageUrl}
                    alt="Maintenance"
                    width={200}
                    height={150}
                    className="rounded-lg object-cover"
                  />
                )}
                {maintenanceMessage && (
                  <p className="text-gray-700">{maintenanceMessage}</p>
                )}
              </div>
            </div>
          )}

          {/* Save button - disabled when validation fails */}
          <Button
            onClick={handleSaveMaintenanceMode}
            disabled={isSaving || !isMaintenanceValid}
          >
            {isSaving ? "Saving..." : "Save Maintenance Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Announcement Banner Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-500" />
            Announcement Banner
          </CardTitle>
          <CardDescription>
            Display a banner at the top of the site for promotions or important notices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="announcement-toggle" className="flex flex-col gap-1">
              <span>Enable Announcement Banner</span>
              <span className="text-sm font-normal text-gray-500">
                Shows at the top of every page
              </span>
            </Label>
            <Switch
              id="announcement-toggle"
              checked={announcementEnabled}
              onCheckedChange={setAnnouncementEnabled}
            />
          </div>

          {/* Announcement text */}
          <div className="space-y-2">
            <Label htmlFor="announcement-text">Banner Text</Label>
            <Input
              id="announcement-text"
              placeholder="Free shipping on orders over $50!"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              maxLength={500}
            />
            <p className="text-xs text-gray-500">
              {announcementText.length}/500 characters
            </p>
          </div>

          {/* Scrolling toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="scrolling-toggle" className="flex flex-col gap-1">
              <span>Scrolling Text</span>
              <span className="text-sm font-normal text-gray-500">
                Animate the text with a marquee effect
              </span>
            </Label>
            <Switch
              id="scrolling-toggle"
              checked={announcementScrolling}
              onCheckedChange={setAnnouncementScrolling}
            />
          </div>

          {/* Preview when enabled */}
          {announcementEnabled && announcementText && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="mb-2 text-sm font-medium text-gray-500">Preview:</p>
              <div className="overflow-hidden bg-blue-600 py-2 text-white">
                {announcementScrolling ? (
                  <div className="animate-marquee whitespace-nowrap">
                    <span className="mx-4">{announcementText}</span>
                    <span className="mx-4">{announcementText}</span>
                  </div>
                ) : (
                  <p className="text-center text-sm">{announcementText}</p>
                )}
              </div>
            </div>
          )}

          {/* Save button */}
          <Button onClick={handleSaveAnnouncementBanner} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Announcement Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Site Logo Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-green-500" />
            Site Logo
          </CardTitle>
          <CardDescription>
            Upload custom logos for your site. Large logo appears in navigation bars, small logo for favicons or compact views.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hidden file input shared by both logo upload zones */}
          <input
            ref={logoFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoFileChange}
            className="hidden"
          />

          {/* Two upload areas: stacked on mobile, side-by-side on md+ */}
          <div className="flex flex-col gap-6 md:flex-row">
            {/* Large logo upload */}
            <div className="flex-1 space-y-2">
              <Label>Large Logo</Label>
              {logoLargeUrl ? (
                <div className="relative inline-block">
                  <Image
                    src={logoLargeUrl}
                    alt="Large site logo"
                    width={200}
                    height={78}
                    className="rounded-lg border object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveLogo("large")}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    aria-label="Remove large logo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 hover:border-gray-400"
                  onClick={() => triggerLogoUpload("large")}
                >
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <p className="mb-1 text-sm text-gray-600">Upload large logo</p>
                  <p className="text-xs text-gray-400">PNG, JPG up to 4MB</p>
                  {isLogoUploading && logoUploadTarget === "large" && (
                    <Loader2 className="mt-2 h-5 w-5 animate-spin text-gray-500" />
                  )}
                </div>
              )}
            </div>

            {/* Small logo upload */}
            <div className="flex-1 space-y-2">
              <Label>Small Logo</Label>
              {logoSmallUrl ? (
                <div className="relative inline-block">
                  <Image
                    src={logoSmallUrl}
                    alt="Small site logo"
                    width={100}
                    height={100}
                    className="rounded-lg border object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveLogo("small")}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    aria-label="Remove small logo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 hover:border-gray-400"
                  onClick={() => triggerLogoUpload("small")}
                >
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <p className="mb-1 text-sm text-gray-600">Upload small logo</p>
                  <p className="text-xs text-gray-400">PNG, JPG up to 4MB</p>
                  {isLogoUploading && logoUploadTarget === "small" && (
                    <Loader2 className="mt-2 h-5 w-5 animate-spin text-gray-500" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Save logo settings */}
          <Button onClick={handleSaveLogoSettings} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Logo Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Shop Carousel Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-purple-500" />
            Shop Carousel
          </CardTitle>
          <CardDescription>
            Manage the homepage carousel. When disabled, it auto-generates from your products.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="carousel-toggle" className="flex flex-col gap-1">
              <span>Custom Carousel</span>
              <span className="text-sm font-normal text-gray-500">
                {carouselEnabled
                  ? "Using custom uploaded media"
                  : "Carousel auto-generates from products"}
              </span>
            </Label>
            <Switch
              id="carousel-toggle"
              checked={carouselEnabled}
              onCheckedChange={setCarouselEnabled}
            />
          </div>

          {/* Carousel content — only shown when custom carousel is enabled */}
          {carouselEnabled && (
            <>
              {/* Upload zone for images and videos */}
              <div className="space-y-2">
                <Label>Upload Media</Label>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 hover:border-gray-400"
                  onClick={() => carouselFileInputRef.current?.click()}
                >
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <p className="mb-1 text-sm text-gray-600">Upload images or videos</p>
                  <p className="text-xs text-gray-400">
                    Images up to 8MB, videos up to 32MB
                  </p>
                  {isCarouselUploading && (
                    <Loader2 className="mt-2 h-5 w-5 animate-spin text-gray-500" />
                  )}
                </div>
                {/* Hidden file input — accepts images and common video formats */}
                <input
                  ref={carouselFileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime"
                  multiple
                  onChange={handleCarouselFileChange}
                  className="hidden"
                />
              </div>

              {/* Grid of uploaded carousel items */}
              {carouselItems.length > 0 && (
                <div className="space-y-2">
                  <Label>Carousel Items ({carouselItems.length})</Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {[...carouselItems]
                      .sort((a, b) => a.order - b.order)
                      .map((item, idx) => (
                        <div
                          key={item.key}
                          className="group relative overflow-hidden rounded-lg border bg-gray-50"
                        >
                          {/* Thumbnail — image or video poster */}
                          {item.type === "image" ? (
                            <Image
                              src={item.url}
                              alt={item.alt ?? `Carousel item ${idx + 1}`}
                              width={200}
                              height={200}
                              className="aspect-square w-full object-cover"
                            />
                          ) : (
                            <video
                              src={item.url}
                              className="aspect-square w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          )}

                          {/* Type badge — shows "Image" or "Video" overlay */}
                          <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {item.type === "image" ? "IMG" : "VID"}
                          </span>

                          {/* Action buttons — remove + reorder, shown on hover/touch */}
                          <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveCarouselItem(item.key)}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                              aria-label="Remove item"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            {/* Move up — hidden for first item */}
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleReorderCarouselItem(item.key, "up")}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-800"
                                aria-label="Move up"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                            )}
                            {/* Move down — hidden for last item */}
                            {idx < carouselItems.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleReorderCarouselItem(item.key, "down")}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-800"
                                aria-label="Move down"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Auto-scroll interval — number input in seconds */}
              <div className="space-y-2">
                <Label htmlFor="carousel-interval">Auto-Scroll Interval (seconds)</Label>
                <Input
                  id="carousel-interval"
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={carouselInterval}
                  onChange={(e) => setCarouselInterval(Number(e.target.value))}
                  className="w-24"
                />
                <p className="text-xs text-gray-500">
                  Time between slides (1–10 seconds)
                </p>
              </div>
            </>
          )}

          {/* Save carousel settings */}
          <Button onClick={handleSaveCarouselSettings} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Carousel Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
