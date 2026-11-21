import { blogApi, type BlogListItem } from "../api/blog";

export interface BlogBuildArticle extends BlogListItem {
  /**
   * The detail endpoint is fetched during the static build so article pages
   * remain readable from a local preview, where the production API may reject
   * the preview origin through CORS.
   */
  content?: string;
}

export interface BlogBuildSnapshot {
  articles: BlogBuildArticle[];
  ok: boolean;
}

// Astro evaluates this module during one build. Caching the promise makes every
// static page and component use the same list response, including a failed
// request that must consistently fall back to the legacy detail route.
let snapshotPromise: Promise<BlogBuildSnapshot> | undefined;

async function getBuildArticleDetail(id: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await blogApi.getBlogDetail(id).send();
    } catch (error) {
      lastError = error;
    }
  }
  console.warn(`Failed to collect article content for ${id}:`, lastError);
  return undefined;
}

export function getBuildBlogSnapshot(): Promise<BlogBuildSnapshot> {
  if (!snapshotPromise) {
    snapshotPromise = blogApi
      .getBlogList({ pageSize: 1000 })
      .send()
      .then((response) => {
        if (!Array.isArray(response?.list)) {
          return { articles: [], ok: false };
        }

        const articles = response.list.filter((article) => Boolean(article?.id));
        return Promise.all(articles.map(async (article) => {
          const detail = await getBuildArticleDetail(article.id);
          if (typeof detail?.content === "string" && detail.content.trim()) {
            return { ...article, content: detail.content };
          }
          return article;
        })).then((articlesWithContent) => ({
          articles: articlesWithContent,
          ok: true,
        }));
      })
      .catch((error) => {
        console.warn("Failed to collect the shared blog build snapshot:", error);
        return { articles: [], ok: false };
      });
  }

  return snapshotPromise;
}
