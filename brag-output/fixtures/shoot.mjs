import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 });

const shots = [
  ['heute.html', 'heute-light.png', 'light'],
  ['noten.html', 'noten-light.png', 'light'],
  ['stundenplan.html', 'stundenplan-light.png', 'light'],
  ['heute.html', 'heute-dark.png', 'dark'],
];

const boxes = {};

async function boxOf(sel) {
  const el = page.locator(sel).first();
  const count = await el.count();
  if (!count) return null;
  const b = await el.boundingBox();
  const appBox = await page.locator('#app').boundingBox();
  if (!b || !appBox) return null;
  // Report in device pixels (deviceScaleFactor 2), relative to #app's top-left,
  // matching the coordinate space of the screenshot PNG.
  return {
    x: Math.round((b.x - appBox.x) * 2),
    y: Math.round((b.y - appBox.y) * 2),
    width: Math.round(b.width * 2),
    height: Math.round(b.height * 2),
  };
}

for (const [file, out, theme] of shots) {
  await page.goto('file://' + path.join(dir, file));
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(300);
  const app = page.locator('#app');
  await app.screenshot({ path: path.join(dir, out) });
  console.log('wrote', out);

  if (file === 'heute.html' && theme === 'light') {
    boxes.heuteChangesCard = await boxOf('.card--accent');
  }
  if (file === 'stundenplan.html') {
    const changed = page.locator('.sp-cell--changed, .sp-cell--cancelled');
    const n = await changed.count();
    boxes.stundenplanCells = [];
    for (let i = 0; i < n; i++) {
      const b = await changed.nth(i).boundingBox();
      const appBox = await page.locator('#app').boundingBox();
      boxes.stundenplanCells.push({
        x: Math.round((b.x - appBox.x) * 2),
        y: Math.round((b.y - appBox.y) * 2),
        width: Math.round(b.width * 2),
        height: Math.round(b.height * 2),
      });
    }
  }
  if (file === 'noten.html') {
    boxes.notenAverage = await boxOf('.average-value');
    boxes.notenSubjectGroups = await boxOf('.grade-group');
  }
}

fs.writeFileSync(path.join(dir, 'boxes.json'), JSON.stringify(boxes, null, 2));
console.log('wrote boxes.json');

await browser.close();
