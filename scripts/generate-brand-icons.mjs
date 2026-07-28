import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

const source = await readFile(new URL("../app/icon.svg", import.meta.url));

const appleIcon = await sharp(source)
  .resize(180, 180)
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(new URL("../app/apple-icon.png", import.meta.url), appleIcon);

const faviconPng = await sharp(source)
  .resize(256, 256)
  .png({ compressionLevel: 9 })
  .toBuffer();

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

const directoryEntry = Buffer.alloc(16);
directoryEntry.writeUInt8(0, 0);
directoryEntry.writeUInt8(0, 1);
directoryEntry.writeUInt8(0, 2);
directoryEntry.writeUInt8(0, 3);
directoryEntry.writeUInt16LE(1, 4);
directoryEntry.writeUInt16LE(32, 6);
directoryEntry.writeUInt32LE(faviconPng.length, 8);
directoryEntry.writeUInt32LE(header.length + directoryEntry.length, 12);

await writeFile(
  new URL("../app/favicon.ico", import.meta.url),
  Buffer.concat([header, directoryEntry, faviconPng]),
);

console.log("Generated app/favicon.ico and app/apple-icon.png from app/icon.svg");
