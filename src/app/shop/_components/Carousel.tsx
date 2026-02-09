/**
 * Carousel - Shop homepage carousel component
 * Displays slides of images (3 per row) or full-width videos with auto-scrolling
 * Uses CSS translateX for smooth slide transitions (1000ms duration)
 * Seamless loop: clones first slide at end, snaps back invisibly after transition
 * Videos loop continuously and don't pause auto-scroll
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { CarouselData } from "~/server/carousel";
import { cropToStyle } from "~/components/ui/ImageCropEditor";

interface CarouselProps {
  data: CarouselData;
}

export function Carousel({ data }: CarouselProps) {
  const { slides, autoScroll, autoScrollInterval } = data;
  const [currentSlide, setCurrentSlide] = useState(0);
  // Controls whether CSS transition is active — disabled during snap-back
  const [isTransitioning, setIsTransitioning] = useState(true);
  // Ref for the auto-scroll interval so we can clear/restart it
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clone first slide at end for seamless looping
  // e.g. [slide0, slide1, slide2, cloneOfSlide0]
  const extendedSlides = slides.length > 1 ? [...slides, slides[0]!] : slides;

  // Advance to the next slide — goes one past last real slide (to the clone)
  const goToNext = useCallback(() => {
    setCurrentSlide((prev) => prev + 1);
  }, []);

  // Navigate to a specific slide via dot click
  const goToSlide = (index: number) => {
    setIsTransitioning(true);
    setCurrentSlide(index);
  };

  // Seamless loop: after transitioning to the clone slide, snap back to slide 0
  // 1. Wait for the 1000ms CSS transition to complete
  // 2. Disable transition so the snap is invisible
  // 3. Set currentSlide to 0
  // 4. Re-enable transition on next animation frame
  useEffect(() => {
    if (currentSlide !== slides.length || slides.length <= 1) return;

    const timeout = setTimeout(() => {
      setIsTransitioning(false);
      setCurrentSlide(0);
      // Re-enable transitions on the next frame so the snap is invisible
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(true);
        });
      });
    }, 1000); // Match the CSS transition duration

    return () => clearTimeout(timeout);
  }, [currentSlide, slides.length]);

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
    // Container: full width edge-to-edge with max constraint, centered
    <div className="w-full max-w-[1440px] overflow-hidden">
      {/* Sliding track — translateX moves between slides */}
      {/* Transition disabled during snap-back to slide 0 for seamless loop */}
      <div
        className={`flex ${isTransitioning ? "transition-transform duration-1000 ease-in-out" : ""}`}
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {extendedSlides.map((slide, slideIdx) => (
          <div
            key={slideIdx}
            className="flex w-full flex-shrink-0 gap-2 sm:gap-4"
          >
            {/* Render based on slide type: images (3 items) or video (full width) */}
            {slide.type === "video" ? (
              // Full-width video slide with 3:1 aspect ratio to match image row height
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
              // 3 images side-by-side — use cropToStyle for positioned images
              slide.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="relative aspect-square w-[calc(33.33%-0.33rem)] flex-shrink-0 overflow-hidden rounded-lg sm:w-[calc(33.33%-0.67rem)]"
                >
                  {/* Conditional rendering: crop uses fill + absolute positioning,
                      default uses explicit dimensions + object-cover */}
                  {item.crop ? (
                    <Image
                      src={item.url}
                      alt={item.alt}
                      fill
                      style={cropToStyle(item.crop)}
                    />
                  ) : (
                    <Image
                      src={item.url}
                      alt={item.alt}
                      width={375}
                      height={375}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {/* Navigation dots — only shown when multiple slides */}
      {/* Dots only for real slides, not the clone */}
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-2 sm:mt-4">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goToSlide(idx)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                // Highlight current slide dot; clone maps back to dot 0
                idx === currentSlide || (currentSlide === slides.length && idx === 0)
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
