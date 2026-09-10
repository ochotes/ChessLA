import { useEffect } from "react";

/** Sets the document title and meta description for the current route. This
 * is a client-rendered SPA, so search engines relying on the initial HTML
 * only see the default tags in index.html — for the small set of fully
 * public marketing pages (landing, how-it-works, leaderboard) a real launch
 * should add prerendering or SSR for these tags to be crawlable; everything
 * behind login doesn't need to be indexed anyway. */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title.includes("ChessLA") ? title : `${title} | ChessLA`;

    let descriptionTag: HTMLMetaElement | null = null;
    let previousDescription: string | null = null;
    if (description) {
      descriptionTag = document.querySelector('meta[name="description"]');
      if (descriptionTag) {
        previousDescription = descriptionTag.getAttribute("content");
        descriptionTag.setAttribute("content", description);
      }
    }

    return () => {
      document.title = previousTitle;
      if (descriptionTag && previousDescription !== null) {
        descriptionTag.setAttribute("content", previousDescription);
      }
    };
  }, [title, description]);
}
