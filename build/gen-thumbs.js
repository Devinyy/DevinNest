import fs from "fs";
import path from "path";
import sharp from "sharp";

// 需要生成缩略图的目录（相对项目根）。卡片封面只需小图，原图留给点击放大的灯箱。
const TARGET_DIRS = ["./public/images/cocktail"];
const THUMB_SUBDIR = "thumbs";
const THUMB_WIDTH = 520; // 卡片最大约 260px，按 2x retina 取 520px
const WEBP_QUALITY = 72;
const SRC_RE = /\.(png|jpe?g|webp)$/i;

// 单个目录：把图片生成同名 .webp 缩略图到 thumbs/ 子目录（增量：源更新才重建）
async function processDir(dir) {
  const absDir = path.resolve(dir);
  if (!fs.existsSync(absDir)) return { made: 0, skipped: 0 };
  const thumbDir = path.join(absDir, THUMB_SUBDIR);
  fs.mkdirSync(thumbDir, { recursive: true });

  let made = 0;
  let skipped = 0;
  for (const name of fs.readdirSync(absDir)) {
    const srcPath = path.join(absDir, name);
    if (!fs.statSync(srcPath).isFile() || !SRC_RE.test(name)) continue;

    const base = name.replace(SRC_RE, "");
    const outPath = path.join(thumbDir, `${base}.webp`);

    // 增量：缩略图已存在且不旧于源图则跳过
    if (fs.existsSync(outPath)) {
      const srcM = fs.statSync(srcPath).mtimeMs;
      const outM = fs.statSync(outPath).mtimeMs;
      if (outM >= srcM) { skipped++; continue; }
    }

    try {
      await sharp(srcPath)
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outPath);
      made++;
      const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
      console.log(`  ✔ thumb ${path.relative(absDir, outPath)} (${kb}KB)`);
    } catch (e) {
      console.warn(`  ⚠ thumb failed for ${name}: ${e?.message}`);
    }
  }
  return { made, skipped };
}

export async function genThumbs() {
  let totalMade = 0;
  let totalSkipped = 0;
  for (const dir of TARGET_DIRS) {
    const { made, skipped } = await processDir(dir);
    totalMade += made;
    totalSkipped += skipped;
  }
  console.log(`Thumbnails ready (${totalMade} generated, ${totalSkipped} up-to-date)`);
}

// 允许独立运行：node build/gen-thumbs.js
if (import.meta.url === `file://${process.argv[1]}`) {
  genThumbs().catch((e) => { console.error(e); process.exit(1); });
}
