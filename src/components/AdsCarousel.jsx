import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";

export default function AdsCarousel({ ads }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % ads.length), 5000);
    return () => clearInterval(t);
  }, [ads.length]);

  if (!ads.length) return null;
  const ad = ads[index];
  const isExternal = /^https?:\/\//.test(ad.link_url || "");

  const Wrapper = ({ children }) =>
    ad.link_url ? (
      isExternal ? (
        <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="block">{children}</a>
      ) : (
        <Link to={ad.link_url} className="block">{children}</Link>
      )
    ) : (
      <div>{children}</div>
    );

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10">
      <Wrapper>
        <div className="relative rounded-2xl overflow-hidden h-40 sm:h-56 bg-[hsl(162,45%,10%)]">
          {ad.image_url && (
            <Image src={ad.image_url} alt={ad.title} className="absolute inset-0 w-full h-full opacity-70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
          <div className="relative h-full flex flex-col justify-center px-6 sm:px-10 max-w-lg">
            <p className="text-amber-400 text-[10px] sm:text-xs tracking-[0.25em] uppercase mb-1">Sponsored</p>
            <h3 className="font-display text-xl sm:text-3xl text-white leading-tight">{ad.title}</h3>
            {ad.subtitle && <p className="text-white/70 text-xs sm:text-sm mt-1.5">{ad.subtitle}</p>}
          </div>
        </div>
      </Wrapper>
      {ads.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {ads.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-emerald-800" : "w-1.5 bg-muted"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
