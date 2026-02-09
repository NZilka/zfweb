/**
 * SettingsClient - Admin settings form
 * Handles maintenance mode and announcement banner configuration
 */
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { AlertTriangle, Megaphone, ImageIcon, X, Upload, Loader2, Film } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { useUploadThing } from "~/utils/uploadthing";
import { updateSettings } from "~/server/settings-actions";
import { CarouselModal } from "./CarouselModal";
import type { SiteSettings, CarouselRow } from "~/server/kv";

interface SettingsClientProps {
  initialSettings: SiteSettings;
  kvAvailable: boolean;
  productImages: { url: string; alt: string }[];
}

// Default message shown when no custom message is set
const DEFAULT_MAINTENANCE_MESSAGE =
  "We're currently performing scheduled maintenance. Please check back soon!";

export function SettingsClient({ initialSettings, kvAvailable, productImages }: SettingsClientProps) {
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

  // Carousel state — row-based grid model
  const [carouselRows, setCarouselRows] = useState<(CarouselRow | null)[]>(
    initialSettings.carousel.rows
  );
  const [autoScrollInterval, setAutoScrollInterval] = useState(
    initialSettings.carousel.autoScrollInterval
  );
  const [carouselModalOpen, setCarouselModalOpen] = useState(false);

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  // File input refs for triggering file pickers
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

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

  // Save carousel settings from the modal — persists rows and interval
  const handleSaveCarousel = async (
    rows: (CarouselRow | null)[],
    interval: number
  ) => {
    setIsSaving(true);
    const result = await updateSettings({
      carousel: {
        rows,
        autoScrollInterval: interval,
      },
    });

    if (result.success) {
      setCarouselRows(rows);
      setAutoScrollInterval(interval);
      setCarouselModalOpen(false);
      toast.success("Carousel settings saved");
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  };

  // Trigger logo file picker for a specific variant
  const triggerLogoUpload = (variant: "large" | "small") => {
    setLogoUploadTarget(variant);
    logoFileInputRef.current?.click();
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

          {/* Preview when enabled — matches shop AnnouncementBar styling */}
          {announcementEnabled && announcementText && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="mb-2 text-sm font-medium text-gray-500">Preview:</p>
              <div className="overflow-hidden border-b border-neutral-200 bg-neutral-100 py-1.5 text-center text-xs tracking-wide text-neutral-600">
                {announcementScrolling ? (
                  <div
                    className="mx-auto overflow-hidden whitespace-nowrap"
                    style={{
                      width: `${Math.ceil(announcementText.length * 1.25)}ch`,
                      maxWidth: "100%",
                    }}
                  >
                    <span className="animate-marquee inline-block">
                      {announcementText}
                      <span
                        className="inline-block"
                        style={{ width: `${announcementText.length}ch` }}
                        aria-hidden="true"
                      />
                      {announcementText}
                      <span
                        className="inline-block"
                        style={{ width: `${announcementText.length}ch` }}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                ) : (
                  <p className="px-4">{announcementText}</p>
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

      {/* Shop Carousel Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-purple-500" />
            Shop Carousel
          </CardTitle>
          <CardDescription>
            Configure the image carousel on the shop homepage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status indicator — shows how many rows are configured */}
          <p className="text-sm text-gray-500">
            {carouselRows.filter((r) => r !== null).length} of 4 rows configured
          </p>
          <Button onClick={() => setCarouselModalOpen(true)}>
            Configure Carousel
          </Button>
        </CardContent>
      </Card>

      {/* Carousel modal — grid-based editor for rows */}
      <CarouselModal
        open={carouselModalOpen}
        onOpenChange={setCarouselModalOpen}
        initialRows={carouselRows}
        initialInterval={autoScrollInterval}
        productImages={productImages}
        onSave={handleSaveCarousel}
      />

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
    </div>
  );
}
