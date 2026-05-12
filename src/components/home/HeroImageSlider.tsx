"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const SLIDES = [
  { src: "/sports/rugby.png",           alt: "Rugby"      },
  { src: "/sports/swimming.png",        alt: "Swimming"   },
  { src: "/sports/basketball-home.png", alt: "Basketball" },
  { src: "/sports/football-home.png",   alt: "Football"   },
];

export default function HeroImageSlider() {
  const [active,  setActive]  = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const next = (active + 1) % SLIDES.length;

  return (
    <>
      {SLIDES.map((slide, i) => {
        // Before hydration: only render the first slide
        // After hydration: render active + next (so transition is smooth)
        const shouldRender = !mounted ? i === 0 : i === active || i === next;
        if (!shouldRender) return null;

        return (
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            fill
            sizes="100vw"
            className={`object-cover object-center transition-opacity duration-1000 ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
            priority={i === 0}
          />
        );
      })}

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-6 bg-white" : "w-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>
    </>
  );
}
