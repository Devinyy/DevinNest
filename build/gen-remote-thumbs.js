import fs from "fs";
import path from "path";
import https from "https";
import crypto from "crypto";
import sharp from "sharp";

// 构建期为「首页博客封面 + 游玩(碎片)封面」生成本地 webp 缩略图。
// 后端原图可达数 MB、且证书过期/8443 非标端口，公网代理拉不到 —— 故在构建机上
// 直接抓接口、下载原图、本地缩放，产出 URL→本地缩略图 的映射表供前端查用。
// 原图仍保留给详情页/灯箱。

const OUT_DIR = path.resolve("./public/images/remote-thumbs");
const MANIFEST_PATH = path.resolve("./src/data/remote-thumbs.json");
const THUMB_WIDTH = 520;       // 卡片最大约 260px，2x retina 取 520
const WEBP_QUALITY = 72;
const TIMEOUT = 15000;

// 与 src/utils/secure-url.ts 保持一致：http→https:8443
function secureUrl(u) {
  if (!u) return "";
  return u.replace(/^http:\/\/devinnest-api\.top(?::\d+)?/i, "https://devinnest-api.top:8443");
}

function readEnvProd(key) {
  try {
    const txt = fs.readFileSync(path.resolve("./.env.production"), "utf8");
    const m = txt.match(new RegExp(`^${key}=(.*)$`, "m"));
    return m ? m[1].trim() : null;
  } catch { return null; }
}

const API_BASE =
  process.env.PUBLIC_API_BASE_URL ||
  readEnvProd("PUBLIC_API_BASE_URL") ||
  "https://devinnest-api.top:8443/api";

// 下载到 Buffer（容忍过期证书 rejectUnauthorized:false，仅构建机本地使用）
function fetchBuffer(url, timeout = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetchBuffer(res.headers.location, timeout).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => req.destroy(new Error(`timeout ${url}`)));
  });
}

async function fetchJson(url) {
  const buf = await fetchBuffer(url);
  return JSON.parse(buf.toString("utf8"));
}

// 从两个首页接口收集所有封面 URL（已统一 secureUrl 归一化）
async function collectCoverUrls() {
  const urls = new Set();
  try {
    const a = await fetchJson(`${API_BASE}/v1/nest/home/latest-articles`);
    for (const it of a?.data?.articles ?? []) {
      if (it.cover) urls.add(secureUrl(it.cover));
    }
  } catch (e) {
    console.warn(`  ⚠ latest-articles 获取失败: ${e?.message}`);
  }
  try {
    const s = await fetchJson(`${API_BASE}/v1/nest/home/latest-snippets`);
    for (const c of s?.data?.diaryCards ?? []) {
      const m = (c.bgStyle || "").match(/bg-\[url\(['"]?(.*?)['"]?\)\]/);
      if (m && m[1]) urls.add(secureUrl(m[1]));
    }
  } catch (e) {
    console.warn(`  ⚠ latest-snippets 获取失败: ${e?.message}`);
  }
  return [...urls];
}

const hashUrl = (u) => crypto.createHash("sha1").update(u).digest("hex").slice(0, 12);

export async function genRemoteThumbs() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 读旧 manifest，接口失败时可沿用
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")); } catch { prev = {}; }

  const urls = await collectCoverUrls();
  if (!urls.length) {
    console.log("Remote thumbs: 未获取到封面 URL（可能离线/接口异常），沿用现有 manifest");
    return;
  }

  let made = 0, cached = 0, failed = 0;
  const next = {};
  for (const url of urls) {
    const name = `${hashUrl(url)}.webp`;
    const outPath = path.join(OUT_DIR, name);
    const publicPath = `/images/remote-thumbs/${name}`;

    // 增量：同 URL 已生成过则跳过（uploads 视为不可变）
    if (fs.existsSync(outPath)) { next[url] = publicPath; cached++; continue; }

    try {
      const buf = await fetchBuffer(url);
      await sharp(buf)
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outPath);
      next[url] = publicPath;
      made++;
      const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
      console.log(`  ✔ remote thumb ${name} (${kb}KB) ← ${url}`);
    } catch (e) {
      console.warn(`  ⚠ remote thumb 失败 ${url}: ${e?.message}`);
      if (prev[url]) next[url] = prev[url]; // 保留旧映射，避免回退到原图
      failed++;
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  console.log(`Remote thumbnails ready (${made} new, ${cached} cached, ${failed} failed)`);
}

// 允许独立运行：node build/gen-remote-thumbs.js
if (import.meta.url === `file://${process.argv[1]}`) {
  genRemoteThumbs().catch((e) => { console.error(e); process.exit(1); });
}
