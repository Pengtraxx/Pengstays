import React from "react";

const MESSAGES = [
  "🌍 Land sales across the continent also available — WhatsApp us to enquire",
  "🏝️ Book shortlets instantly and pay online with Flutterwave",
  "🏠 List your property free — go live once approved",
  "📈 Invest smarter: premium listings vetted by our team",
];

// A slow, continuous horizontal scroll built from CSS keyframes (see
// index.css / tailwind.config.js for the `marquee` animation). Duplicating
// the content once lets the loop wrap seamlessly.
export default function MarqueeBar() {
  const text = MESSAGES.join("      •      ");
  return (
    <div className="bg-amber-400 text-emerald-950 text-xs sm:text-sm font-medium overflow-hidden whitespace-nowrap select-none">
      <div className="flex animate-marquee py-1.5">
        <span className="px-4">{text}</span>
        <span className="px-4" aria-hidden="true">{text}</span>
      </div>
    </div>
  );
}
