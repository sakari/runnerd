import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "assets");

// Running figure SVG — stylized runner silhouette
const runnerPath = `
  M 540 220
  c 0,-55 -45,-100 -100,-100
  c -55,0 -100,45 -100,100
  c 0,55 45,100 100,100
  c 55,0 100,-45 100,-100 Z
  M 620 410
  l -80,-60
  l -120,90
  l -100,-40
  l -60,120
  l 50,25
  l 40,-80
  l 60,24
  l -80,200
  l 55,22
  l 100,-200
  l 60,180
  l 55,-18
  l -80,-220
  l 100,-80
  Z
`;

// Simplified, bolder runner for better icon readability
const boldRunnerSvg = (size, padding, bgColor, fgColor, rounded) => {
  const r = rounded ? size * 0.2 : 0;
  // A clear running figure, designed for app icon sizes
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${bgColor}"/>
  <g transform="translate(${size * 0.5}, ${size * 0.52}) scale(${size / 320})">
    <!-- Head -->
    <circle cx="30" cy="-105" r="28" fill="${fgColor}"/>
    <!-- Body / torso leaning forward -->
    <path d="
      M 30,-75
      L 10, 0
      L -10, 0
      L 10,-75
      Z
    " fill="${fgColor}"/>
    <!-- Front arm -->
    <path d="
      M 25,-65
      Q 55,-40 40,-10
      L 28,-15
      Q 38,-38 18,-55
      Z
    " fill="${fgColor}"/>
    <!-- Back arm -->
    <path d="
      M 5,-60
      Q -45,-30 -55,-15
      L -45,-5
      Q -35,-22 0,-48
      Z
    " fill="${fgColor}"/>
    <!-- Front leg (extended back) -->
    <path d="
      M 5, 0
      Q -40,35 -65,80
      L -50,88
      Q -30,48 10,12
      Z
    " fill="${fgColor}"/>
    <!-- Back leg (bent forward, knee up) -->
    <path d="
      M -5, 0
      Q 30,20 50,5
      Q 55,30 40,60
      L 52,65
      Q 65,30 58,0
      Q 35,25 5,8
      Z
    " fill="${fgColor}"/>
    <!-- Front foot -->
    <path d="
      M -65,80
      Q -80,85 -82,78
      Q -75,72 -55,76
      Z
    " fill="${fgColor}"/>
    <!-- Back foot -->
    <path d="
      M 40,60
      Q 50,70 58,68
      Q 60,60 48,58
      Z
    " fill="${fgColor}"/>
  </g>
</svg>`;
};

async function generate() {
  const green = "#22cc44";
  const darkBg = "#111111";

  // icon.png — 1024x1024, iOS app icon (no rounding, iOS adds it)
  const iconSvg = boldRunnerSvg(1024, 100, darkBg, green, false);
  await sharp(Buffer.from(iconSvg)).png().toFile(join(assetsDir, "icon.png"));
  console.log("icon.png (1024x1024)");

  // adaptive-icon.png — 1024x1024, Android adaptive icon foreground
  // Needs extra padding since Android crops to circle/squircle
  const adaptiveSvg = boldRunnerSvg(1024, 200, darkBg, green, false);
  await sharp(Buffer.from(adaptiveSvg))
    .png()
    .toFile(join(assetsDir, "adaptive-icon.png"));
  console.log("adaptive-icon.png (1024x1024)");

  // splash-icon.png — 1024x1024, splash screen
  const splashSvg = boldRunnerSvg(1024, 150, darkBg, green, false);
  await sharp(Buffer.from(splashSvg))
    .png()
    .toFile(join(assetsDir, "splash-icon.png"));
  console.log("splash-icon.png (1024x1024)");

  // favicon.png — 48x48
  const faviconSvg = boldRunnerSvg(48, 4, darkBg, green, true);
  await sharp(Buffer.from(faviconSvg)).png().toFile(join(assetsDir, "favicon.png"));
  console.log("favicon.png (48x48)");

  console.log("Done!");
}

generate().catch(console.error);
