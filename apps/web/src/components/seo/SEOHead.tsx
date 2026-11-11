import { useEffect } from "react";

export interface SEOHeadProps {
  readonly title: string;
  readonly description?: string;
  readonly canonical?: string;
  readonly noindex?: boolean;
}

/**
 * Lightweight, zero-dependency document head updater for client-side routing.
 * Synchronizes title, description, canonical link, and robots indexation directives.
 */
export function SEOHead({
  title,
  description,
  canonical,
  noindex = false,
}: SEOHeadProps) {
  useEffect(() => {
    // 1. Synchronize document title
    document.title = title;

    // 2. Synchronize meta description
    if (description) {
      let descMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!descMeta) {
        descMeta = document.createElement("meta");
        descMeta.setAttribute("name", "description");
        document.head.appendChild(descMeta);
      }
      descMeta.setAttribute("content", description);
    }

    // 3. Synchronize canonical link
    if (canonical) {
      let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute("href", canonical);
    }

    // 4. Synchronize robots directive
    let robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.setAttribute("name", "robots");
      document.head.appendChild(robotsMeta);
    }

    if (noindex) {
      robotsMeta.setAttribute("content", "noindex, follow");
    } else {
      robotsMeta.setAttribute(
        "content",
        "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      );
    }
  }, [title, description, canonical, noindex]);

  return null;
}
