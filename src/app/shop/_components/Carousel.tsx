/**
 * Carousel - Shop homepage carousel component
 * Displays slides of images (3 per row) or full-width videos with auto-scrolling
 * Uses CSS translateX for smooth slide transitions (1000ms duration)
 * Videos loop continuously and don't pause auto-scroll
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

  // Auto-scroll effect — runs interval when enabled
  // Videos loop continuously and don't block auto-scroll
  useEffect(() => {
    if (!autoScroll || slides.length <= 1) return;

    intervalRef.current = setInterval(goToNext, autoScrollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoScroll, autoScrollInterval, slides.length, goToNext]);

  return (
    // Container: full width with max constraint, centered
    <div className="w-full max-w-[1440px] overflow-hidden px-2 sm:px-4">
      {/* Sliding track — translateX moves between slides, 1000ms transition (slower) */}
      <div
        className="flex transition-transform duration-1000 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, slideIdx) => (
          <div
            key={slideIdx}
            className="flex w-full flex-shrink-0 gap-2 sm:gap-4"
          >
            {/* Render based on slide type: images (3 items) or video (full width) */}
            {slide.type === "video" ? (
              // Full-width video slide with 3:1 aspect ratio to match image row height
              // (images are square at 1/3 width each, so video height = 1/3 of full width)
              // object-cover zooms in equally on all sides to fill the frame
              <video
                src={slide.url}
                autoPlay
                muted
                playsInline
                loop
                className="aspect-[3/1] w-full flex-shrink-0 rounded-lg object-cover"
                style={{
                  objectPosition: `center ${slide.videoPositionY ?? 50}%`,
                }}
              />
            ) : (
              // 3 images side-by-side
              slide.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="w-[calc(33.33%-0.33rem)] flex-shrink-0 overflow-hidden rounded-lg sm:w-[calc(33.33%-0.67rem)]"
                >
                  <Image
                    src={item.url}
                    width={375}
                    height={375}
                    alt={item.alt}
                    className="h-auto w-full object-contain"
                  />
                </div>
              ))
            )}
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
