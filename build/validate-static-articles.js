import fs from "node:fs";
import path from "node:path";

const fail = (message) => {
  console.error(`Static article validation failed: ${message}`);
  process.exitCode = 1;
};

const apiBase = String(process.env.PUBLIC_API_BASE_URL || "").trim();
if (!apiBase) {
  fail("PUBLIC_API_BASE_URL is required");
} else {
  let apiUrl;
  try {
    const base = new URL(apiBase);
    if (!/^https?:$/.test(base.protocol)) throw new Error("unsupported protocol");
    apiUrl = new URL(`${apiBase.replace(/\/+$/, "")}/v1/nest/blog/list`);
    apiUrl.searchParams.set("pageSize", "1000");
  } catch (error) {
    fail(`PUBLIC_API_BASE_URL must be an absolute HTTP(S) URL: ${error.message}`);
  }

  if (apiUrl) {
    try {
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`blog list returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      const code = payload?.code;
      if (code !== undefined && ![0, 200, "0", "200"].includes(code)) {
        throw new Error(`blog list returned API code ${code}`);
      }

      const data = payload?.data !== undefined ? payload.data : payload;
      const list = Array.isArray(data) ? data : data?.list;
      if (!Array.isArray(list)) {
        throw new Error("blog list response has no array data.list");
      }

      const expectedIds = new Set(
        list
          .filter((article) => article && article.id)
          .map((article) => String(article.id)),
      );
      const articleRoot = path.resolve("dist/blog/article");
      const actualIds = new Set();
      if (fs.existsSync(articleRoot)) {
        for (const entry of fs.readdirSync(articleRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (!fs.existsSync(path.join(articleRoot, entry.name, "index.html"))) {
            throw new Error(`article route is missing index.html: ${entry.name}`);
          }
          try {
            actualIds.add(decodeURIComponent(entry.name));
          } catch {
            actualIds.add(entry.name);
          }
        }
      }

      const missing = [...expectedIds].filter((id) => !actualIds.has(id));
      const unexpected = [...actualIds].filter((id) => !expectedIds.has(id));
      if (missing.length || unexpected.length) {
        throw new Error(
          `expected ${expectedIds.size} static article routes, found ${actualIds.size}; ` +
          `missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}`,
        );
      }

      console.log(`Static article routes validated: ${actualIds.size}`);
    } catch (error) {
      fail(error?.message || String(error));
    }
  }
}
