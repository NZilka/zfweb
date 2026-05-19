/**
 * Carousel - Shop homepage carousel component
 * Displays slides of images (3 per row) or full-width videos with auto-scrolling
 * Uses Web Animations API for slide transitions with a custom multi-segment
 * curve: fast for the first 93% of motion, then progressively slowing across
 * the final 7%. Total transition is 1700ms.
 * Seamless loop: clones first slide at end, snaps back invisibly after transition.
 * Videos loop continuously and don't pause auto-scroll.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { CarouselData } from "~/server/carousel";
import { cropToStyle } from "~/components/ui/ImageCropEditor";

interface CarouselProps {
  data: CarouselData;
}

// Slide transition timing.
// Original was 1000ms ease-in-out. New curve adds 700ms of progressive
// deceleration across the final 7% of motion: 400ms for 93%→98%, 300ms
// for 98%→100%. Total = 1700ms.
const SLIDE_DURATION_MS = 1700;
// Offset 0..1 = animation time as a fraction of total duration.
// Offset value = motion progress 0..1 reached at that time.
const KEYFRAME_TIME_AT_93PCT = 1000 / SLIDE_DURATION_MS; // ~0.588
const KEYFRAME_TIME_AT_98PCT = 1400 / SLIDE_DURATION_MS; // ~0.824

export function Carousel({ data }: CarouselProps) {
  const { slides, autoScroll, autoScrollInterval } = data;
  const [currentSlide, setCurrentSlide] = useState(0);
  // Controls whether the slide change animates — disabled during snap-back
  const [isTransitioning, setIsTransitioning] = useState(true);
  // Ref for the auto-scroll interval so we can clear/restart it
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref to the sliding track div so the Web Animations API can target it
  const trackRef = useRef<HTMLDivElement>(null);
  // Translate (in % units) that the track was last at, so each new animation
  // knows its starting point. Updated synchronously with each slide change.
  const prevTranslateRef = useRef(0);

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

  // Run the custom-curve slide animation whenever currentSlide changes
  // during a normal transition. Skipped during snap-back (isTransitioning
  // false), in which case the inline style.transform handles the instant jump.
  useEffect(() => {
    const targetTranslate = -currentSlide * 100;

    if (!isTransitioning || !trackRef.current) {
      // Snap-back path — inline style already moved us; just record the new
      // position so the next animation has the correct starting point.
      prevTranslateRef.current = targetTranslate;
      return;
    }

    if (prevTranslateRef.current === targetTranslate) {
      // No motion needed (same slide); nothing to animate
      return;
    }

    const from = prevTranslateRef.current;
    const to = targetTranslate;
    const delta = to - from;
    // Helper: translateX value at a given fraction of total motion (0..1)
    const at = (motionProgress: number) =>
      `translateX(${from + delta * motionProgress}%)`;

    // Guard: Web Animations API is not implemented in some test environments
    // (e.g. happy-dom). When unavailable, skip the animation — the inline
    // style.transform already updated to the target, so the slide just jumps
    // (acceptable test-env behavior; real browsers always have .animate).
    if (typeof trackRef.current.animate === "function") {
      // Multi-keyframe animation: time offsets map non-linearly to motion
      // progress. Sub-segment easings smooth the joins between the three
      // segments so the slowdown feels progressive rather than stepped.
      trackRef.current.animate(
        [
          { transform: at(0), offset: 0, easing: "ease-in-out" },
          { transform: at(0.93), offset: KEYFRAME_TIME_AT_93PCT, easing: "ease-out" },
          { transform: at(0.98), offset: KEYFRAME_TIME_AT_98PCT, easing: "ease-in" },
          { transform: at(1), offset: 1 },
        ],
        { duration: SLIDE_DURATION_MS, fill: "forwards" },
      );
    }

    prevTranslateRef.current = targetTranslate;
  }, [currentSlide, isTransitioning]);

  // Seamless loop: after transitioning to the clone slide, snap back to slide 0
  // 1. Wait for the SLIDE_DURATION_MS animation to complete
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
    }, SLIDE_DURATION_MS);

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
      {/* Sliding track — translateX moves between slides.
          Inline transform is the "resting" position (where the element is
          after the Web Animations API animation finishes via fill:forwards,
          or where it jumps to during the no-animation snap-back). */}
      <div
        ref={trackRef}
        className="flex"
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
                  {/* Conditional rendering: crop uses absolute positioning via cropToStyle,
                      default uses explicit dimensions + object-cover.
                      Can't use fill with cropToStyle — fill forces width:100% which conflicts. */}
                  {item.crop ? (
                    <Image
                      src={item.url}
                      alt={item.alt}
                      width={750}
                      height={750}
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
