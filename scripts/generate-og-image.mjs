import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

const iconSource = await readFile(new URL("../app/icon.svg", import.meta.url));
const iconSize = 220;
const iconPng = await sharp(iconSource).resize(iconSize, iconSize).png().toBuffer();

const background = sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: "#0d0d0d",
  },
}).png();

const textX = 90 + iconSize + 70;
const overlay = Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <text x="${textX}" y="270" font-family="Georgia, 'Playfair Display', serif" font-weight="700"
      font-size="98" letter-spacing="-1" fill="#f2ede6">SYNARAVA</text>
    <rect x="${textX + 2}" y="308" width="60" height="2" fill="#e44b61"/>
    <text x="${textX + 78}" y="315" font-family="Arial, 'Hanken Grotesk', sans-serif" font-weight="600"
      font-size="15" letter-spacing="3" fill="#a89c8f">CURATED GOODS WITH CHARACTER</text>
    <text x="${textX + 2}" y="368" font-family="Arial, 'Hanken Grotesk', sans-serif" font-weight="400"
      font-size="21" letter-spacing="0.5" fill="#a89c8f">Handcrafted jewelry, pet accessories, kids' creative kits,</text>
    <text x="${textX + 2}" y="398" font-family="Arial, 'Hanken Grotesk', sans-serif" font-weight="400"
      font-size="21" letter-spacing="0.5" fill="#a89c8f">and tools for making by hand.</text>
  </svg>
`);

const image = await background
  .composite([
    { input: iconPng, left: 90, top: Math.round((HEIGHT - iconSize) / 2) },
    { input: overlay, left: 0, top: 0 },
  ])
  .jpeg({ quality: 92 })
  .toBuffer();

await writeFile(new URL("../public/og-default.jpg", import.meta.url), image);

console.log("Generated public/og-default.jpg");
