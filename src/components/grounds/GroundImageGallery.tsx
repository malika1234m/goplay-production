"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  images:       string[];
  categoryIcon: string;
  altText:      string;
}

export default function GroundImageGallery({ images, categoryIcon, altText }: Props) {
  const [active,    setActive]    = useState(0);
  const [lightbox,  setLightbox]  = useState(false);

  if (!images || images.length === 0) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl h-72 flex items-center justify-center border border-green-100">
        <span className="text-9xl">{categoryIcon}</span>
      </div>
    );
  }

  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);
  const next = () => setActive((i) => (i + 1) % images.length);

  return (
    <>
      {/* Main gallery */}
      <div className="flex flex-col gap-3">
        {/* Main image */}
        <div
          className="relative h-72 rounded-2xl overflow-hidden bg-slate-100 cursor-pointer group"
          onClick={() => setLightbox(true)}
        >
          <Image
            src={images[active]}
            alt={`${altText} - image ${active + 1}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={active === 0}
            sizes="(max-width: 1024px) 100vw, 66vw"
          />
          {/* Overlay hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full transition-opacity">
              Click to enlarge
            </span>
          </div>
          {/* Nav arrows — only when multiple images */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors sm:opacity-0 sm:group-hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors sm:opacity-0 sm:group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              {/* Counter */}
              <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">
                {active + 1} / {images.length}
              </div>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                  i === active ? "border-green-500 scale-105" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={src} alt={`${altText} thumb ${i + 1}`} fill className="object-cover" sizes="64px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="relative max-w-4xl w-full max-h-[85vh] aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[active]}
              alt={`${altText} - image ${active + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setActive(i); }}
                    className={`w-2 h-2 rounded-full transition-all ${i === active ? "bg-white scale-125" : "bg-white/40"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
