/**
 * Fast TeX check for MDX files without a build: renders every $…$ and $$…$$ (in the body and in props such as
 * caption="…" and prompt="…") with KaTeX in the build's strict mode, and reports each failure with its line.
 * Also flags Hebrew letters inside math, which KaTeX strict mode rejects.
 *
 * Usage: ./node_modules/.bin/tsx scripts/dev/tex-check.ts src/content/lessons/ch2/2-1-*.mdx < /dev/null
 * Exit code 1 when anything fails. It is a pre-check: `npm run build` stays the authority (it also parses the MDX).
 */

import { readFileSync } from 'node:fs';
import katex from 'katex';

let bad = 0;
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8');
  // drop front matter and fenced code
  const body = src.replace(/^---[\s\S]*?\n---\n/, (m) => m.replace(/[^\n]/g, ' ')).replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '));
  // a display fence must be alone on its line: "$$ text $x$" shifts every later $ pairing, and MDX then reads a `{`
  // inside some later formula as JavaScript (the build fails far from the cause)
  body.split('\n').forEach((ln, i) => {
    const t = ln.trim();
    if (t.includes('$$') && t !== '$$' && !/^\$\$[^$]+\$\$$/.test(t) && !/=["{]/.test(t)) {
      bad++;
      console.log(`${file}:${i + 1}: a $$ fence shares its line with other text: ${t.slice(0, 80)}`);
    }
  });
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(body))) {
    const display = m[1] !== undefined;
    const tex = (m[1] ?? m[2]).trim();
    const line = body.slice(0, m.index).split('\n').length;
    n++;
    if (/[֐-׿]/.test(tex)) {
      bad++;
      console.log(`${file}:${line}: Hebrew inside math: ${tex.slice(0, 80)}`);
      continue;
    }
    try {
      katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: 'error' });
    } catch (e) {
      bad++;
      console.log(`${file}:${line}: ${(e as Error).message.split('\n')[0]}  in  ${tex.slice(0, 100)}`);
    }
  }
  console.log(`${file}: ${n} formulas checked`);
}
process.exit(bad ? 1 : 0);
