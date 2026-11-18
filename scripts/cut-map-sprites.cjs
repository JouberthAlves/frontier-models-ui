// Cut the Magnific sprite sheets (4×3 grid on flat magenta) into trimmed transparent WebP sprites,
// and tone the ground textures. Usage: node cut-sprites.cjs <srcDir> <outDir>
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const [src, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const SHEETS = {
  'sheet-vegetation.png': ['tree-round', 'tree-round-dark', 'oak', 'bush', 'palm', 'palm-2', 'pine', 'pine-2', 'bushes', 'hedge', 'flowers', 'rocks'],
  'sheet-village.png': ['house', 'house-square', 'house-l', 'house-long', 'church', 'umbrella-coral', 'umbrella-teal', 'sailboat', 'rowboat', 'bridge', 'stand', 'fence'],
};

async function keyMagenta(buf, w, h) {
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < buf.length; i += 3, j += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    // distance from pure magenta; magenta has high r and b and low g
    const d = Math.sqrt((255 - r) ** 2 + g ** 2 + (255 - b) ** 2);
    let a = Math.min(1, Math.max(0, (d - 70) / 90));
    let rr = r, bb = b;
    if (a < 1) {
      // despill: pull the magenta cast out of edge pixels
      const cap = g + 30;
      rr = Math.min(r, Math.max(cap, (r + g) / 2));
      bb = Math.min(b, Math.max(cap, (b + g) / 2));
    }
    px[j] = rr; px[j + 1] = g; px[j + 2] = bb; px[j + 3] = Math.round(a * 255);
  }
  return px;
}

// Cells where an object overflowed its grid cell: crop box in the 800 px preview coordinates.
const OVERRIDE = { oak: [402, 70, 628, 280], bush: [648, 120, 765, 235] };

(async () => {
  const manifest = {};
  for (const [file, names] of Object.entries(SHEETS)) {
    const img = sharp(path.join(src, file));
    const { width, height } = await img.metadata();
    const cw = Math.floor(width / 4), ch = Math.floor(height / 3);
    for (let k = 0; k < names.length; k++) {
      const col = k % 4, row = Math.floor(k / 4);
      const k8 = width / 800; const ov = OVERRIDE[names[k]]; const box = ov ? { left: Math.round(ov[0] * k8), top: Math.round(ov[1] * k8), width: Math.round((ov[2] - ov[0]) * k8), height: Math.round((ov[3] - ov[1]) * k8) } : { left: col * cw, top: row * ch, width: cw, height: ch }; const cell = await sharp(path.join(src, file)).extract(box).removeAlpha().raw().toBuffer();
      const rgba = await keyMagenta(cell, box.width, box.height);
      const trimmed = await sharp(rgba, { raw: { width: box.width, height: box.height, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
      const name = names[k];
      const maxSide = 256;
      const res = await sharp(trimmed.data).resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(out, `${name}.webp`));
      manifest[name] = { w: res.width, h: res.height, bytes: res.size };
    }
  }
  // Ground textures: tone down toward the approved pastel mockup, 512 px tiles.
  const tex = { 'tex-grass.png': ['grass', { saturation: 0.72, brightness: 1.0 }], 'tex-sand.png': ['sand', { saturation: 0.7, brightness: 1.03 }], 'tex-sea.png': ['sea', { saturation: 0.9, brightness: 1.0 }] };
  for (const [file, [name, mod]] of Object.entries(tex)) {
    const res = await sharp(path.join(src, file)).modulate(mod).resize(512, 512).webp({ quality: 80 }).toFile(path.join(out, `${name}.webp`));
    manifest[name] = { w: res.width, h: res.height, bytes: res.size, tile: true };
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const total = Object.values(manifest).reduce((s, m) => s + m.bytes, 0);
  console.log(Object.keys(manifest).length, 'files', (total / 1024).toFixed(0), 'KB');
})();
