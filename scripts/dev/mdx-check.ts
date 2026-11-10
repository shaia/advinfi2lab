/**
 * Compile MDX files with the build's markdown pipeline (remark-math + rehype-katex, strict) without a build, and report
 * the first error of each file with its line: catches what tex-check cannot, such as a `{` that MDX reads as a
 * JavaScript expression because a `$` earlier on the page did not open math, or an unclosed JSX tag.
 *
 * Usage: ./node_modules/.bin/tsx scripts/dev/mdx-check.ts src/content/lessons/ch2/*.mdx < /dev/null
 */

import { readFileSync } from 'node:fs';
import { compile } from '@mdx-js/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

let bad = 0;
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8').replace(/^---[\s\S]*?\n---\n/, (m) => '\n'.repeat(m.split('\n').length - 1));
  try {
    await compile(src, { remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { throwOnError: true, strict: 'error' }]] });
    console.log(`${file}: ok`);
  } catch (e) {
    bad++;
    const err = e as { line?: number; column?: number; place?: { line: number; column: number }; message: string };
    const at = err.place ? `${err.place.line}:${err.place.column}` : err.line ? `${err.line}:${err.column}` : '?';
    console.log(`${file}:${at}: ${err.message.split('\n')[0]}`);
  }
}
process.exit(bad ? 1 : 0);
