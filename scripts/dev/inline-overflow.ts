/**
 * Phone-width math check: lists every inline formula wider than its text line at 390 px (inline math never
 * wraps, so it is clipped there) and every display formula wider than its box (it scrolls inside the box).
 * Needs the preview server on :4381. Usage (Git Bash):
 *   MSYS_NO_PATHCONV=1 ./node_modules/.bin/tsx scripts/dev/inline-overflow.ts /lessons/1-3/ /workbook/1-3/ < /dev/null
 */
import { chromium } from '@playwright/test';
const paths = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  for (const p of paths) {
    await page.goto(`http://localhost:4381${p}`);
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => ((d as HTMLDetailsElement).open = true)));
    await page.waitForTimeout(300);
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const k of document.querySelectorAll<HTMLElement>('.katex')) {
        if (k.closest('.katex-display')) continue;
        let block = k.parentElement!;
        while (block && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement!;
        const cs = getComputedStyle(block);
        const avail = block.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const w = k.getBoundingClientRect().width;
        if (w > avail + 1) {
          const tex = k.querySelector('annotation')?.textContent ?? k.textContent;
          const host = k.closest('[id]')?.id ?? '';
          out.push(`${Math.round(w)}>${Math.round(avail)} [${host}] ${tex}`);
        }
      }
      for (const d of document.querySelectorAll<HTMLElement>('.katex-display')) {
        const inner = d.querySelector<HTMLElement>('.katex')!;
        const w = inner.getBoundingClientRect().width;
        if (w > d.clientWidth + 1) {
          const tex = d.querySelector('annotation')?.textContent ?? '';
          out.push(`DISPLAY ${Math.round(w)}>${Math.round(d.clientWidth)} [${d.closest('[id]')?.id ?? ''}] ${tex.slice(0, 120)}`);
        }
      }
      return out;
    });
    console.log(`== ${p}: ${bad.length}`);
    for (const b of bad) console.log('  ' + b);
  }
  await browser.close();
})();
