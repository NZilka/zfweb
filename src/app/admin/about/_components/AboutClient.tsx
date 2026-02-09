/**
 * AboutClient - Admin editor for the About page content
 * Manages enabled toggle, title, content (plain text), and image gallery
 * Follows the same pattern as SettingsClient for consistency
 */
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { AlertTriangle, FileText, Upload, X, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { useUploadThing } from "~/utils/uploadthing";
import { updateSettings } from "~/server/settings-actions";
import type { AboutSettings, AboutImage } from "~/server/kv";

interface AboutClientProps {
  initialAbout: AboutSettings;
  kvAvailable: boolean;
}

export function AboutClient({ initialAbout, kvAvailable }: AboutClientProps) {
  // About page form state
  const [enabled, setEnabled] = useState(initialAbout.enabled);
  const [title, setTitle] = useState(initialAbout.title ?? "");
  const [content, setContent] = useState(initialAbout.content ?? "");
  const [images, setImages] = useState<AboutImage[]>(initialAbout.images);

  // Form control state
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // File input ref for triggering the file picker
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UploadThing hook — reuses existing imageUploader route for about images
  const { startUpload } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res) => {
      if (res) {
        // Append new images to the gallery with default alt text
        const newImages: AboutImage[] = res.map((file) => ({
          url: file.url,
          key: file.key,
          alt: "",
        }));
        setImages((prev) => [...prev, ...newImages]);
        toast.success(
          `${res.length} image${res.length > 1 ? "s" : ""} uploaded`
        );
      }
      setIsUploading(false);
    },
    onUploadError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    },
  });

  // Handle file selection — validates count and size before uploading
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Enforce max 5 images per upload, 10 total
    const remaining = 10 - images.length;
    if (remaining <= 0) {
      toast.error("Maximum 10 images allowed");
      return;
    }

    const fileArray = Array.from(files).slice(0, Math.min(5, remaining));

    // Validate each file is under 8MB
    for (const file of fileArray) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 8MB limit`);
        return;
      }
    }

    setIsUploading(true);
    await startUpload(fileArray);

    // Reset input so same files can be selected again
    e.target.value = "";
  };

  // Remove an image from the gallery by index
  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Update alt text for a specific image
  const handleAltChange = (index: number, alt: string) => {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, alt } : img))
    );
  };

  // Save all about settings to KV
  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateSettings({
      about: {
        enabled,
        title: title || null,
        content: content || null,
        images,
      },
    });

    if (result.success) {
      toast.success("About page settings saved");
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  };

  // Show warning if KV is not configured
  if (!kvAvailable) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">About Page</h1>
        <Card className="border-yellow-500 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Configuration Required
            </CardTitle>
            <CardDescription className="text-yellow-700">
              Settings storage is not configured. Please set up Upstash KV by
              adding UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
              environment variables.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">About Page</h1>

      {/* About Page Content Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            About Page Content
          </CardTitle>
          <CardDescription>
            Configure the content displayed on the public About page at
            /shop/about.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable toggle — controls visibility of /shop/about and nav link */}
          <div className="flex items-center justify-between">
            <Label htmlFor="about-toggle" className="flex flex-col gap-1">
              <span>Enable About Page</span>
              <span className="text-sm font-normal text-gray-500">
                When enabled, shows in navigation and accessible at /shop/about
              </span>
            </Label>
            <Switch
              id="about-toggle"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Title input — max 200 characters */}
          <div className="space-y-2">
            <Label htmlFor="about-title">Page Title</Label>
            <Input
              id="about-title"
              placeholder="About Zilka Forgewerks"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-gray-500">{title.length}/200 characters</p>
          </div>

          {/* Content textarea — plain text, newlines rendered as paragraphs on shop */}
          <div className="space-y-2">
            <Label htmlFor="about-content">Content</Label>
            <Textarea
              id="about-content"
              placeholder="Tell your story... Newlines will be rendered as separate paragraphs on the shop page."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              maxLength={10000}
            />
            <p className="text-xs text-gray-500">
              {content.length}/10000 characters
            </p>
          </div>

          {/* Image gallery — upload, preview, alt text, remove */}
          <div className="space-y-3">
            <Label>Images ({images.length}/10)</Label>

            {/* Existing images grid — 1 col mobile, 2 col sm+ */}
            {images.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {images.map((img, index) => (
                  <div
                    key={img.key}
                    className="relative rounded-lg border p-3 space-y-2"
                  >
                    {/* Image preview with remove button */}
                    <div className="relative">
                      <Image
                        src={img.url}
                        alt={img.alt || "About image"}
                        width={300}
                        height={200}
                        className="h-40 w-full rounded object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {/* Alt text input for accessibility */}
                    <Input
                      placeholder="Alt text (for accessibility)"
                      value={img.alt}
                      onChange={(e) => handleAltChange(index, e.target.value)}
                      maxLength={200}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Upload zone — shown when under the 10 image limit */}
            {images.length < 10 && (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 hover:border-gray-400">
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                <p className="mb-2 text-sm text-gray-600">
                  Upload about page images
                </p>
                <p className="mb-4 text-xs text-gray-400">
                  PNG, JPG, GIF up to 8MB each (max 5 at a time)
                </p>
                {/* Hidden file input — supports multiple selection */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
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
                    "Choose Files"
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Save button */}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save About Page Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
