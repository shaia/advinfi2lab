import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { readdir, readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import {
  bankSchema,
  glossarySchema,
  lessonSchema,
  misconceptionSchema,
  summarySchema,
  videoSchema,
  workbookSchema,
} from './lib/schemas';

export * from './lib/schemas';

/**
 * A collection kept as one YAML list per lesson (`<dir>/1-5.yaml`, …), merged into one collection.
 * Per-lesson files let lessons be written in parallel without editing a shared file; a duplicate id
 * across files fails the build.
 */
function yamlDir(dir: string) {
  return async () => {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.yaml')).sort();
    const seen = new Map<string, string>();
    const entries: { id: string }[] = [];
    for (const f of files) {
      const list = (parse(await readFile(`${dir}/${f}`, 'utf8')) ?? []) as { id: string }[];
      for (const e of list) {
        if (seen.has(e.id)) throw new Error(`${dir}: id "${e.id}" appears in both ${seen.get(e.id)} and ${f}`);
        seen.set(e.id, f);
        entries.push(e);
      }
    }
    return entries;
  };
}

const lessons = defineCollection({ loader: glob({ base: './src/content/lessons', pattern: '**/*.mdx' }), schema: lessonSchema });
const questions = defineCollection({ loader: glob({ base: './src/content/questions', pattern: '**/*.yaml' }), schema: bankSchema });
const misconceptions = defineCollection({ loader: yamlDir('src/content/misconceptions'), schema: misconceptionSchema });
const glossary = defineCollection({ loader: yamlDir('src/content/glossary'), schema: glossarySchema });
const videos = defineCollection({ loader: yamlDir('src/content/videos'), schema: videoSchema });
const workbook = defineCollection({ loader: glob({ base: './src/content/workbook', pattern: '**/*.yaml' }), schema: workbookSchema });
const summaries = defineCollection({ loader: glob({ base: './src/content/summaries', pattern: '*.mdx' }), schema: summarySchema });

export const collections = { lessons, questions, misconceptions, glossary, videos, workbook, summaries };
