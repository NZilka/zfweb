/**
 * SettingsClient - Admin settings form
 * Handles maintenance mode and announcement banner configuration
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { AlertTriangle, Megaphone, X, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { UploadDropzone } from "~/utils/uploadthing";
import { updateSettings } from "~/server/settings-actions";
import type { SiteSettings } from "~/server/kv";

interface SettingsClientProps {
  initialSettings: SiteSettings;
  kvAvailable: boolean;
}

export function SettingsClient({ initialSettings, kvAvailable }: SettingsClientProps) {
  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(
    initialSettings.maintenanceMode.enabled
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    initialSettings.maintenanceMode.message ?? ""
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

  // Form state
  const [isSaving, setIsSaving] = useState(false);

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
              // Uses dedicated maintenance endpoint (1 image max)
              <UploadDropzone
                endpoint="maintenanceImageUploader"
                onClientUploadComplete={(res) => {
                  if (res?.[0]) {
                    setMaintenanceImageUrl(res[0].url);
                    setMaintenanceImageKey(res[0].key);
                    toast.success("Image uploaded");
                  }
                }}
                onUploadError={(error: Error) => {
                  toast.error(`Upload failed: ${error.message}`);
                }}
                className="ut-label:text-sm ut-allowed-content:text-xs border-dashed"
              />
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
    </div>
  );
}
