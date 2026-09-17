import * as React from "react"
import { cn } from "@/lib/utils"

// Generic placeholder shown when a listing/agent has no photo, or when an
// image fails to load (e.g. a broken/expired Supabase Storage URL).
const FALLBACK_IMAGE_URL =
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"

/**
 * Lightweight responsive <img> wrapper. Images are served as-is from
 * Supabase Storage (or any external URL) — no server-side transform
 * pipeline is assumed. Falls back to a placeholder image on load error.
 */
const Image = React.forwardRef(
  ({ src, alt = "", className, style, originWidth, originHeight, ...props }, ref) => {
    const [imgSrc, setImgSrc] = React.useState(src || FALLBACK_IMAGE_URL)

    React.useEffect(() => {
      setImgSrc(src || FALLBACK_IMAGE_URL)
    }, [src])

    const aspectRatio = originWidth && originHeight ? `${originWidth} / ${originHeight}` : undefined

    return (
      <img
        ref={ref}
        src={imgSrc}
        alt={alt}
        loading="lazy"
        className={cn("object-cover", className)}
        style={{ aspectRatio, ...style }}
        onError={() => setImgSrc(FALLBACK_IMAGE_URL)}
        {...props}
      />
    )
  }
)
Image.displayName = "Image"

export { Image }
