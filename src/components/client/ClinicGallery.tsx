/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Camera, Utensils, Scale, Sparkles } from 'lucide-react';

interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  title: string;
  caption: string;
  icon: React.ElementType;
}

export const ClinicGallery: React.FC = () => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const items: GalleryItem[] = [
    {
      id: 'consultation',
      src: '/images/clinic_consultation.jpg',
      alt: 'Serene consultation room with oak desk and lush indoor plants',
      title: 'Consultation Room',
      caption: 'Quiet, private, and filled with natural daylight.',
      icon: Sparkles,
    },
    {
      id: 'reception',
      src: '/images/clinic_reception.jpg',
      alt: 'Warm reception lounge with sage green textured wall and curved wood desk',
      title: 'Reception Lounge',
      caption: 'A welcoming space designed to reduce clinical anxiety.',
      icon: Camera,
    },
    {
      id: 'meals',
      src: '/images/healthy_meals.jpg',
      alt: 'Artful balanced whole food bowls with wholesome greens, legumes, and healthy fats',
      title: 'Whole-Food Frameworks',
      caption: 'Simple, flavorful nourishment without deprivation.',
      icon: Utensils,
    },
    {
      id: 'scale',
      src: '/images/kitchen_scale.jpg',
      alt: 'Digital kitchen food scale on marble counter with fresh crisp apples and almonds',
      title: 'Practical Pantry Habits',
      caption: 'Actionable portion intuition for everyday living.',
      icon: Scale,
    },
  ];

  const handleImageError = (id: string) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <section className="py-12 border-t border-stone-200/80">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Spaces &amp; Philosophy
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
            Our clinic environment
          </h2>
        </div>
        <span className="text-xs text-stone-500 bg-stone-100 px-2.5 py-1 rounded-md font-medium">
          Illustrative images
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map((item) => {
          const hasError = failedImages[item.id];
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="group bg-white rounded-2xl overflow-hidden border border-stone-200/90 shadow-xs flex flex-col transition-all hover:shadow-md"
            >
              <div className="relative aspect-4/3 w-full bg-stone-100 overflow-hidden">
                {!hasError ? (
                  <img
                    src={item.src}
                    alt={item.alt}
                    width={400}
                    height={300}
                    loading="lazy"
                    onError={() => handleImageError(item.id)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-emerald-50 via-stone-100 to-amber-50 flex flex-col items-center justify-center p-4 text-center text-stone-600">
                    <Icon className="w-8 h-8 text-emerald-700 mb-2 opacity-80" />
                    <span className="text-xs font-semibold text-stone-800">{item.title}</span>
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">{item.title}</h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    {item.caption}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
