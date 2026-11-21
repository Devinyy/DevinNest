import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

async function sourceOrEmpty(path) {
  try {
    return await source(path);
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

test("public navigation only exposes implemented destinations", async () => {
  const nav = await source("src/components/sticky_nav.astro");

  assert.doesNotMatch(nav, /href="\/(?:funny|about|contact)"/);
  assert.doesNotMatch(nav, /placeholder="搜索文章/);
  assert.match(nav, /href="\/bloglist"/);
  assert.match(nav, /href="\/fragmentlist"/);
});

test("homepage metadata uses the deployed site and describes the blog", async () => {
  const index = await source("src/pages/index.astro");

  assert.doesNotMatch(index, /xxxxxxxxx|xxxxxx/);
  assert.match(index, /在好奇中探索，在生活里记录……/);
  assert.match(index, /aria-label="在好奇中探索，在生活里记录……"/);
  assert.match(index, /apple-touch-icon-180x180\.png/);
  assert.match(index, /rel="canonical"/);
});

test("article details have honest fallbacks and no fake local interaction UI", async () => {
  const detail = await source("src/pages/blog/detail.astro");
  const state = await source("src/components/article_load_state.astro");

  assert.doesNotMatch(detail, /articleTitle = qp\.get\('title'\) \|\| "未知"/);
  assert.doesNotMatch(detail, /id="commentForm"/);
  assert.doesNotMatch(detail, /localStorage\.(getItem|setItem).*?(like:|bookmark:|comments:)/s);
  assert.match(`${detail}\n${state}`, /文章暂时没能打开/);
  assert.match(detail, /当前浏览器不支持分享/);
});

test("blog list detail links keep the article id for runtime loading", async () => {
  const list = await source("src/components/articles_list_blog.astro");

  assert.match(list, /params = new URLSearchParams\(\{[\s\S]*id: article\.id/);
});

test("blog archive refreshes its timeline from the current API", async () => {
  const list = await source("src/pages/bloglist.astro");

  assert.match(list, /import \{ blogApi \} from "\.\.\/api\/blog"/);
  assert.match(list, /blogApi\.getBlogList\(\{ pageSize: 1000 \}\)/);
  assert.match(list, /id="timeline-groups"/);
});

test("runtime timeline refresh keeps the timeline visuals and recent node state", async () => {
  const list = await source("src/pages/bloglist.astro");

  assert.match(list, /:global\(\.timeline\)/);
  assert.match(list, /:global\(\.timeline-item\)::before/);
  assert.match(list, /function isRecentTimelinePost\(item, year\)/);
  assert.match(list, /timeline-item \$\{isRecentTimelinePost\(item, year\) \? 'is-current-year' : ''\}/);
});

test("blog archive refreshes categories, tags, and counts with visible fallback status", async () => {
  const list = await source("src/pages/bloglist.astro");

  assert.match(list, /Promise\.allSettled/);
  assert.match(list, /blogApi\.getCategories\(\)/);
  assert.match(list, /blogApi\.getHotTags\(\)/);
  assert.match(list, /renderCategoryStats/);
  assert.match(list, /renderTagStats/);
  assert.match(list, /最新内容同步失败/);
});

test("article cards prefer built static routes and keep the legacy fallback", async () => {
  const cards = await source("src/components/articles_list.astro");
  const archiveCards = await source("src/components/articles_list_blog.astro");

  assert.match(cards, /blog\/article/);
  assert.match(cards, /blog\/detail\?id=/);
  assert.match(archiveCards, /blog\/article/);
  assert.match(archiveCards, /blog\/detail\?id=/);
});

test("each built article page exposes server-rendered share metadata", async () => {
  const page = await source("src/pages/blog/article/[id].astro");

  assert.match(page, /getStaticPaths/);
  assert.match(page, /property="og:title"/);
  assert.match(page, /property="og:description"/);
  assert.match(page, /property="og:url"/);
  assert.match(page, /property="og:image"/);
  assert.match(page, /rel="canonical"/);
  assert.match(page, /devinnest\.top/);
});

test("production builds fail closed when the blog API fails and validate static routes", async () => {
  const workflow = await source(".github/workflows/deploy.yml");
  const route = await source("src/pages/blog/article/[id].astro");
  const validator = await source("build/validate-static-articles.js");

  assert.match(workflow, /PUBLIC_API_BASE_URL:\s*https:\/\/devinnest-api\.top:8443\/api/);
  assert.match(workflow, /run: node build\/validate-static-articles\.js/);
  assert.match(route, /if \(!snapshot\.ok\)/);
  assert.match(route, /refusing to publish an empty static article route set/);
  assert.match(validator, /PUBLIC_API_BASE_URL is required/);
  assert.match(validator, /expectedIds/);
  assert.match(validator, /actualIds/);
  assert.match(validator, /unexpected=/);
});

test("production builds use a fingerprint-verified API tunnel without leaking it to browsers", async () => {
  const workflow = await source(".github/workflows/deploy.yml");
  const request = await source("src/utils/request.ts");
  const thumbs = await source("build/gen-remote-thumbs.js");
  const validator = await source("build/validate-static-articles.js");

  assert.match(workflow, /name: Open build API SSH tunnel/);
  assert.match(workflow, /ssh-keyscan -T 10 -t ecdsa/);
  assert.match(workflow, /ssh-keygen -lf - -E sha256/);
  assert.match(workflow, /-L "127\.0\.0\.1:\$\{BUILD_API_PORT\}:127\.0\.0\.1:8000"/);
  assert.match(workflow, /BUILD_API_BASE_URL: http:\/\/127\.0\.0\.1:18080\/api/);
  assert.match(workflow, /name: Close build API SSH tunnel[\s\S]*if: \$\{\{ always\(\) \}\}/);
  assert.doesNotMatch(workflow, /echo\s+["']?\$SERVER_SSH_KEY/);
  assert.match(request, /import\.meta\.env\.SSR/);
  assert.match(request, /import\.meta\.env\.BUILD_API_BASE_URL/);
  assert.match(thumbs, /process\.env\.BUILD_API_BASE_URL/);
  assert.match(thumbs, /protocol === "http:"/);
  assert.match(validator, /process\.env\.BUILD_API_BASE_URL/);
});

test("production site configuration has a real fallback", async () => {
  const config = await source("astro.config.mjs");

  assert.match(config, /https:\/\/devinnest\.top/);
  assert.doesNotMatch(config, /xxx\.xxxxx\.com/);
});

test("homepage mobile shell constrains viewport-sized media and content", async () => {
  const index = await source("src/pages/index.astro");

  assert.match(index, /html,\s*body\s*\{[\s\S]*?margin:\s*0/);
  assert.match(index, /\.index-content\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(index, /\.index-content\s*\{[\s\S]*?width:\s*100%/);
  assert.match(index, /\.cover-img\s*\{[\s\S]*?left:\s*0[\s\S]*?width:\s*100%/);
  assert.match(index, /\.index-content \.cover-img\s*\{[\s\S]*?width:\s*100%/);
  assert.match(index, /:global\(\.main img\)\s*\{[\s\S]*?max-width:\s*100%/);
});

test("static build keeps stylesheet URLs on the deployed origin", async () => {
  const postbuild = await source("build/postbuild.js");

  assert.doesNotMatch(postbuild, /\$\{site\}\/\_astro/);
  assert.match(postbuild, /indexHtml/);
});

test("homepage forest-cover copy stays readable without utility CSS", async () => {
  const index = await source("src/pages/index.astro");

  assert.match(index, /\.cover-tittle\s*\{[\s\S]*?color:\s*(?:#fff|white)/);
  assert.match(index, /\.cover-tittle\s*\{[\s\S]*?text-shadow:/);
});

test("static article routes and links share one build-time article snapshot", async () => {
  const snapshot = await source("src/data/blog_build_snapshot.ts");
  const route = await source("src/pages/blog/article/[id].astro");
  const archive = await source("src/pages/bloglist.astro");
  const homeList = await source("src/components/articles_list.astro");

  assert.match(snapshot, /getBuildBlogSnapshot/);
  assert.match(snapshot, /snapshotPromise/);
  assert.match(route, /getBuildBlogSnapshot\(\)/);
  assert.match(archive, /getBuildBlogSnapshot\(\)/);
  assert.match(homeList, /getBuildBlogSnapshot\(\)/);
  assert.doesNotMatch(route, /blogApi\.getBlogList\(\{\s*pageSize:\s*1000\s*\}\)/);
  const archiveFrontmatter = archive.slice(archive.indexOf("---") + 3, archive.indexOf("---", 3));
  assert.doesNotMatch(archiveFrontmatter, /blogApi\.getBlogList\(\{\s*pageSize:\s*1000\s*\}\)/);
  assert.doesNotMatch(homeList, /blogApi\.getBlogList\(\{\s*pageSize:\s*1000\s*\}\)/);
});

test("static article pages carry build-time content for same-origin preview", async () => {
  const snapshot = await source("src/data/blog_build_snapshot.ts");
  const page = await source("src/pages/blog/article/[id].astro");

  assert.match(snapshot, /getBlogDetail/);
  assert.match(snapshot, /content/);
  assert.match(page, /articleContent/);
  assert.match(page, /content:\s*articleContent/);
  assert.match(page, /typeof params\.content === "string"/);
  assert.match(page, /article-layout/);
  assert.match(page, /article-toc-card/);
});

test("fragment list keeps a local snapshot and reports runtime sync failures", async () => {
  const page = await source("src/pages/fragmentlist.astro");

  assert.match(page, /fragment_timeline/);
  assert.match(page, /id="fragment-data-status"/);
  assert.match(page, /最新内容同步失败/);
  assert.match(page, /snippetApi\.getSnippetTimeline\(\)\.send\(\)/);
  assert.match(page, /renderFragmentTimeline/);
  assert.match(page, /catch[\s\S]*保留/);
});

test("article pages expose loading, slow, error, retry, and not-found states", async () => {
  const legacy = await source("src/pages/blog/detail.astro");
  const staticPage = await source("src/pages/blog/article/[id].astro");
  const state = await sourceOrEmpty("src/components/article_load_state.astro");

  for (const page of [legacy, staticPage]) {
    assert.match(page, /ArticleLoadState/);
    assert.match(page, /createArticleLoadController/);
    assert.match(page, /renderMarkdownToElement/);
  }
  assert.match(legacy, /getBuildBlogSnapshot/);
  assert.match(legacy, /buildArticles/);
  assert.match(legacy, /buildArticles\?\.\[id\]|buildArticles\[id\]/);
  assert.match(state, /正在翻开这篇文章/);
  assert.match(state, /这篇文章还在路上，请稍等片刻/);
  assert.match(state, /文章暂时没能打开/);
  assert.match(state, /可能是网络开了个小差/);
  assert.match(state, />重新加载</);
  assert.match(state, />返回博客列表</);
  assert.match(state, /data-article-load="not-found"/);
  assert.match(state, /role="status"/);
  assert.match(state, /role="alert"/);
});

test("legacy and static article pages keep the header aligned with the content and toc row", async () => {
  const legacy = await source("src/pages/blog/detail.astro");
  const staticPage = await source("src/pages/blog/article/[id].astro");

  for (const page of [legacy, staticPage]) {
    assert.match(page, /class="article-main max-w-screen-2xl/);
    assert.match(page, /\.article-layout\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0/);
    assert.match(page, /\.article-layout\s*>\s*(?:article|aside)[\s\S]*?min-width:\s*0/);
  }
  assert.match(staticPage, /<article class="article-shell">/);
  assert.doesNotMatch(staticPage, /<article class="max-w-4xl mx-auto">/);
});

test("404 game fits its 404 glyph on mobile and binds the animation loop before scheduling", async () => {
  const page = await source("src/pages/404.astro");

  assert.match(page, /this\.loop = this\.loop\.bind\(this\);\s*this\.init\(\)/);
  assert.doesNotMatch(page, /this\.animationId = requestAnimationFrame\(this\.loop\);\s*this\.init\(\)/);
  assert.match(page, /const sidePadding =/);
  assert.match(page, /const totalWidth = cols \* brickWidth \+ Math\.max\(0, cols - 1\) \* CONFIG\.brickGap/);
  assert.match(page, /startX = Math\.max\(sidePadding, \(this\.width - totalWidth\) \/ 2\)/);
});

test("article retry and lifecycle listeners are registered before the first await", async () => {
  const legacy = await source("src/pages/blog/detail.astro");
  const staticPage = await source("src/pages/blog/article/[id].astro");

  for (const page of [legacy, staticPage]) {
    const firstLoadAwait = page.lastIndexOf("await loadArticle();");
    const retryRegistration = page.indexOf("data-article-retry");
    const pagehideRegistration = Math.max(
      page.indexOf("window.addEventListener('pagehide'"),
      page.indexOf('window.addEventListener("pagehide"'),
    );
    assert.ok(firstLoadAwait > -1, "article page should await its initial load");
    assert.ok(retryRegistration > -1 && retryRegistration < firstLoadAwait, "retry must be wired before initial loading can reject");
    assert.ok(pagehideRegistration > -1 && pagehideRegistration < firstLoadAwait, "lifecycle cleanup must be wired before initial loading can reject");
  }
});

test("article highlighting uses the local vendor stylesheet without a Vite CSS preload", async () => {
  const legacy = await source("src/pages/blog/detail.astro");
  const renderer = await source("src/utils/md-renderer.js");

  for (const sourceText of [legacy, renderer]) {
    assert.match(sourceText, /highlight\.github-dark\.min\.css/);
    assert.doesNotMatch(sourceText, /import\(['"]highlight\.js\/styles\/github-dark\.min\.css['"]\)/);
  }
  assert.match(legacy, /\/libs\/vendor\/highlight\.github-dark\.min\.css/);
  assert.match(renderer, /\/libs\/vendor\/highlight\.github-dark\.min\.css/);
});

test("article loading controller guards stale requests and clears timers", async () => {
  const controller = await sourceOrEmpty("src/utils/article-load-state.js");
  const state = await sourceOrEmpty("src/components/article_load_state.astro");

  assert.match(controller, /requestSerial/);
  assert.match(controller, /isCurrent/);
  assert.match(controller, /clearTimeout/);
  assert.match(controller, /setTimeout/);
  assert.match(state, /这篇文章还在路上，请稍等片刻/);
  assert.match(controller, /prefers-reduced-motion/);
  assert.match(controller, /isArticleNotFoundError/);
  assert.match(controller, /article-layout-error/);
});

test("markdown rendering reports failures to article loading states", async () => {
  const renderer = await source("src/utils/md-renderer.js");

  assert.match(renderer, /return false/);
  assert.match(renderer, /return true/);
});

test("request handling checks HTTP status before content type parsing", async () => {
  const request = await source("src/utils/request.ts");
  const response = await source("src/utils/api-response.js");

  assert.match(response, /response\.ok/);
  assert.match(response, /response\.status/);
  assert.match(request, /parseApiResponse/);
  assert.match(request, /retry\(methodInstance/);
  assert.match(request, /cacheFor/);
});
