/**
 * Carousel - Shop homepage carousel component
 * Displays slides of 3 items (images/videos) with auto-scrolling
 * Uses CSS translateX for smooth slide transitions
 * Pauses auto-scroll when a video is playing
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { CarouselData } from "~/server/carousel";

interface CarouselProps {
  data: CarouselData;
}

export function Carousel({ data }: CarouselProps) {
  const { slides, autoScroll, autoScrollInterval } = data;
  const [currentSlide, setCurrentSlide] = useState(0);
  // Track whether a video is playing to pause auto-scroll
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  // Ref for the auto-scroll interval so we can clear/restart it
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Advance to the next slide, wrapping around
  const goToNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  // Navigate to a specific slide via dot click
  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Auto-scroll effect — runs interval when enabled and video not playing
  useEffect(() => {
    if (!autoScroll || isVideoPlaying || slides.length <= 1) return;

    intervalRef.current = setInterval(goToNext, autoScrollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoScroll, autoScrollInterval, isVideoPlaying, slides.length, goToNext]);

  // Video event handlers — pause carousel during playback
  const handleVideoPlay = () => setIsVideoPlaying(true);
  const handleVideoEnded = () => setIsVideoPlaying(false);

  return (
    // Container: full width with max constraint, centered
    <div className="w-full max-w-[1440px] overflow-hidden px-2 sm:px-4">
      {/* Sliding track — translateX moves between slides */}
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, slideIdx) => (
          // Each slide takes full width, items arranged side-by-side
          <div
            key={slideIdx}
            className="flex w-full flex-shrink-0 gap-2 sm:gap-4"
          >
            {slide.items.map((item, itemIdx) => (
              // Each item takes ~1/3 of slide width
              <div
                key={itemIdx}
                className="w-[calc(33.33%-0.33rem)] flex-shrink-0 overflow-hidden rounded-lg sm:w-[calc(33.33%-0.67rem)]"
              >
                {item.type === "image" ? (
                  <Image
                    src={item.url}
                    width={469}
                    height={469}
                    alt={item.alt}
                    className="h-auto w-full object-contain"
                  />
                ) : (
                  // Video: autoplay muted, pauses carousel timer on play
                  <video
                    src={item.url}
                    autoPlay
                    muted
                    playsInline
                    className="h-auto w-full object-contain"
                    onPlay={handleVideoPlay}
                    onEnded={handleVideoEnded}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Navigation dots — only shown when multiple slides */}
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-2 sm:mt-4">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goToSlide(idx)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                idx === currentSlide
                  ? "bg-white"
                  : "bg-gray-500 hover:bg-gray-400"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
