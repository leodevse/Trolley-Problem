/**
 * optimize-images.js
 * Nén ảnh PNG lớn → WebP nhỏ gọn cho web.
 * Tạo 2 phiên bản:
 *   - thumb (width 240px) → dùng cho card trong tay
 *   - medium (width 500px) → dùng cho card trên bàn + detail modal
 * Giữ lại file PNG gốc (không xoá).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMG_DIR = path.join(__dirname, '..', 'public', 'images');
const OUT_DIR = path.join(IMG_DIR, 'optimized');

const SIZES = [
    { suffix: 'thumb', width: 240, quality: 72 },
    { suffix: 'medium', width: 500, quality: 78 },
];

async function run() {
    // Create output dir
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const files = fs.readdirSync(IMG_DIR).filter(f => /\.(png|jpe?g)$/i.test(f));
    console.log(`Found ${files.length} images to optimize...\n`);

    let totalOriginal = 0;
    let totalOptimized = 0;

    for (const file of files) {
        const src = path.join(IMG_DIR, file);
        const stat = fs.statSync(src);
        const originalKB = (stat.size / 1024).toFixed(0);
        totalOriginal += stat.size;

        const baseName = path.parse(file).name;

        for (const size of SIZES) {
            const outName = `${baseName}-${size.suffix}.webp`;
            const outPath = path.join(OUT_DIR, outName);

            await sharp(src)
                .resize({ width: size.width, withoutEnlargement: true })
                .webp({ quality: size.quality })
                .toFile(outPath);

            const outStat = fs.statSync(outPath);
            const outKB = (outStat.size / 1024).toFixed(1);
            totalOptimized += outStat.size;

            console.log(`  ${file} (${originalKB}KB) → ${outName} (${outKB}KB)`);
        }
    }

    // Also create a full-quality version for the detail modal (larger)
    for (const file of files) {
        const src = path.join(IMG_DIR, file);
        const baseName = path.parse(file).name;
        const outName = `${baseName}-full.webp`;
        const outPath = path.join(OUT_DIR, outName);

        await sharp(src)
            .resize({ width: 800, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toFile(outPath);

        const outStat = fs.statSync(outPath);
        totalOptimized += outStat.size;
        console.log(`  ${file} → ${outName} (${(outStat.size / 1024).toFixed(1)}KB) [full]`);
    }

    console.log(`\n✅ Done!`);
    console.log(`   Original total: ${(totalOriginal / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   Optimized total: ${(totalOptimized / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   Saved: ${((1 - totalOptimized / totalOriginal) * 100).toFixed(1)}%`);
}

run().catch(console.error);
