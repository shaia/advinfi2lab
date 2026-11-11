/**
 * The content schemas, without Astro: src/content.config.ts wires them into collections, and
 * scripts/lint-content.ts validates every YAML file against them, so a schema error is caught by the
 * edit hook on save instead of only by the build.
 */

import { z } from 'astro/zod';

export const objective = z.object({ id: z.string().regex(/^OBJ-\d+\.\d+-\d+$/), text: z.string() });

export const lessonSchema = z.object({
    id: z.string().regex(/^\d+\.\d+$/),
    chapter: z.number().int().min(0).max(11),
    order: z.number().int().min(1),
    title: z.string(),
    subtitle: z.string().optional(),
    // no time cap (the user's decision, 2026-11-10): `minutes` is the honest length of one study session; the upper
    // bound only catches a typo (an extra digit)
    minutes: z.number().int().min(5).max(600),
    objectives: z.array(objective).min(1),
    prerequisites: z.array(z.string()).default([]),
    videos: z.array(z.string()).default([]),
    figures: z.array(z.string()).default([]),
    /** lessons whose place in course 80316 is unverified are marked enrichment (src/course.ts decides) */
    enrichment: z.boolean().default(false),
    draft: z.boolean().default(false),
  });

const choice = z.object({
  text: z.string(),
  correct: z.boolean().default(false),
  feedback: z.string(),
  misconception: z.string().optional(),
});

const common = {
  /** a lesson's understanding question (Q-1.5-sup) or a chapter's review question (Q-1-review-07) */
  id: z.string().regex(/^Q-(\d+\.\d+-[\w-]+|\d+-review-\d{2})$/),
  objectives: z.array(z.string()).min(1),
  prompt: z.string(),
  /** a question about meaning (a definition, a counterexample, a true/false claim), not a computation */
  qualitative: z.boolean().default(false),
  /** בסיס: one definition or one step; בינוני: two steps or a short proof; מבחן: as on an 80316 exam */
  level: z.enum(['basic', 'mid', 'exam']).default('basic'),
  hints: z.array(z.string()).default([]),
  /** worked explanation shown after answering, whatever the answer */
  explanation: z.string().optional(),
  /** ask "sure / not sure" before checking: separates misconceptions from gaps */
  confidence: z.boolean().default(true),
  /** show mc/multi/twotier choices in a fixed shuffled order; false keeps a deliberate order */
  shuffle: z.boolean().default(true),
};

const directions = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se', 'out', 'in', 'zero'] as const;

/** The type-specific fields of each auto-graded kind, shared by stand-alone questions and Exam parts. */
const bodies = {
  mc: { type: z.literal('mc'), choices: z.array(choice).min(2) },
  multi: { type: z.literal('multi'), choices: z.array(choice).min(2) },
  numeric: {
    type: z.literal('numeric'),
    answer: z.number(),
    /** usually empty in mathematics */
    unit: z.string().default(''),
    /** relative tolerance: answers in this course are exact, so the default only absorbs rounding */
    tolerance: z.number().positive().max(0.2).default(0.005),
    correctFeedback: z.string(),
    wrongFeedback: z.string(),
    /** recognisable wrong numbers, each traced to a misconception */
    commonWrong: z
      .array(z.object({ value: z.number(), feedback: z.string(), misconception: z.string().optional() }))
      .default([]),
  },
  vector: {
    type: z.literal('vector'),
    answer: z.enum(directions),
    /** figure drawn above the rose: an SVG snippet name from src/assessment/diagrams */
    diagram: z.string().optional(),
    allowOutIn: z.boolean().default(false),
    correctFeedback: z.string(),
    wrong: z
      .array(z.object({ dir: z.enum(directions), feedback: z.string(), misconception: z.string().optional() }))
      .default([]),
    wrongFeedback: z.string(),
  },
  rank: {
    type: z.literal('rank'),
    items: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
    /**
     * correct order, first item first (largest first, or the first step of a proof); groups as nested arrays.
     * Without `help` (ranking magnitudes) a group is a tie the student must mark with „=”. With `help` (ordering
     * a proof's steps) a group is a set of steps that may come in any order: accepted in any order, tied or not.
     */
    order: z.array(z.union([z.string(), z.array(z.string())])),
    /** the instruction above the list; present ⇒ the items are the steps of a proof (see `order`) */
    help: z.string().optional(),
    correctFeedback: z.string(),
    wrongFeedback: z.string(),
  },
  twotier: {
    type: z.literal('twotier'),
    choices: z.array(choice).min(2),
    reasonPrompt: z.string().default('ומה הנימוק?'),
    reasons: z.array(choice).min(2),
  },
};

const mc = z.object({ ...common, ...bodies.mc });
const multi = z.object({ ...common, ...bodies.multi });
const numeric = z.object({ ...common, ...bodies.numeric });
const vector = z.object({ ...common, ...bodies.vector });
const rank = z.object({ ...common, ...bodies.rank });
const twotier = z.object({ ...common, ...bodies.twotier });

/* ---- Exam question in the format of an 80316 final: a setting with lettered parts (א, ב, ג…) ---- */

/**
 * The steps of a written solution or proof, shared by open exam parts and the workbook. The labels the
 * student sees live in STEP_LABEL (src/assessment/steps.ts). A solution ends in a `result` step.
 */
export const STEP_KINDS = ['given', 'goal', 'idea', 'definition', 'theorem', 'step', 'computation', 'check', 'result'] as const;
const solutionStep = z.object({ kind: z.enum(STEP_KINDS), text: z.string() });

const { id: _commonId, ...commonFields } = common;
const partCommon = {
  ...commonFields,
  /** a part may list no objective only while it waits for the lesson that owns it (pendingObjectives) */
  objectives: z.array(z.string()).default([]),
  /** the Hebrew letter that heads the part: א, ב, ג… */
  label: z.string().min(1).max(3),
  points: z.number().int().min(1).max(20),
  /** false when the part needs an answer from an earlier part: the chapter test then leaves it out */
  standalone: z.boolean().default(true),
  /** objectives of lessons not written yet, as free text; the engine ignores them and lint lists them */
  pendingObjectives: z.array(z.string()).default([]),
};

/** A part answered in free text and graded by the student against a model solution and a rubric. */
const openBody = {
  type: z.literal('open'),
  /** the model solution or proof, one step per entry */
  solution: z.array(solutionStep).min(1),
  /** the checklist the student ticks against their own work */
  rubric: z.array(z.object({ text: z.string(), weight: z.number().positive().default(1) })).min(2),
  /** fraction of the rubric weight that counts as "correct" for mastery evidence */
  passMark: z.number().min(0.5).max(1).default(0.75),
};

const part = z.discriminatedUnion('type', [
  z.object({ ...partCommon, ...bodies.mc }),
  z.object({ ...partCommon, ...bodies.multi }),
  z.object({ ...partCommon, ...bodies.numeric }),
  z.object({ ...partCommon, ...bodies.vector }),
  z.object({ ...partCommon, ...bodies.rank }),
  z.object({ ...partCommon, ...bodies.twotier }),
  z.object({ ...partCommon, ...openBody }),
]);

const exam = z.object({
  ...commonFields,
  id: z.string().regex(/^Q-\d+-exam-\d+$/),
  type: z.literal('exam'),
  title: z.string(),
  /** the setting that all parts share */
  prompt: z.string(),
  /** inline SVG markup drawn under the setting (math space: x grows to the right, LTR) */
  diagram: z.string().optional(),
  /** accessible description of the diagram: required when there is one */
  diagramAlt: z.string().optional(),
  /** filled from the parts when omitted; see examObjectives() */
  objectives: z.array(z.string()).default([]),
  level: z.literal('exam').default('exam'),
  parts: z.array(part).min(2).max(6),
});

export const question = z.discriminatedUnion('type', [mc, multi, numeric, vector, rank, twotier, exam]);
export type Question = z.infer<typeof question>;
export type ExamQuestion = Extract<Question, { type: 'exam' }>;
export type Part = ExamQuestion['parts'][number];
export type OpenPart = Extract<Part, { type: 'open' }>;
export type AutoPart = Exclude<Part, OpenPart>;

export const bankSchema = z.object({ chapter: z.number().int(), questions: z.array(question) });

export const misconceptionSchema = z.object({
    id: z.string().regex(/^MC-[\w-]+$/),
    title: z.string(),
    belief: z.string(),
    truth: z.string(),
    /** where to go to unlearn it: a lesson id plus an anchor or figure */
    remedy: z.object({ lesson: z.string(), anchor: z.string().optional(), label: z.string() }),
  });

export const glossarySchema = z.object({
    id: z.string(),
    term: z.string(),
    en: z.string(),
    definition: z.string(),
    symbol: z.string().optional(),
    unit: z.string().optional(),
    /** spellings that must not appear in course text */
    reject: z.array(z.string()).default([]),
    lesson: z.string().optional(),
  });

export const videoSchema = z.object({
    id: z.string(),
    youtubeId: z.string().regex(/^[\w-]{11}$/),
    title: z.string(),
    channel: z.string(),
    lang: z.enum(['he', 'en']),
    captions: z.array(z.enum(['he', 'en'])).default([]),
    start: z.number().int().min(0).default(0),
    end: z.number().int().optional(),
    minutes: z.number(),
    why: z.string(),
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

/* ---- Lesson workbook: open practice problems and sourced challenge problems, answers hidden ---- */

const workbookItem = {
  objectives: z.array(z.string()).min(1),
  prompt: z.string(),
  /** inline SVG markup drawn under the prompt (math space: x grows to the right, LTR) */
  diagram: z.string().optional(),
  /** accessible description of the diagram: required when there is one */
  diagramAlt: z.string().optional(),
  /** the short final answer: a value, a set, or a one-line decision (true / false and why) */
  answer: z.string(),
  solution: z.array(solutionStep).min(1),
};
export const workbookSchema = z.object({
    lesson: z.string().regex(/^\d+\.\d+$/),
    practice: z.array(
      z.object({
        id: z.string().regex(/^W-\d+\.\d+-\d{2}$/),
        level: z.enum(['basic', 'mid', 'exam']),
        qualitative: z.boolean().default(false),
        ...workbookItem,
      }),
    ),
    challenge: z.array(
      z.object({
        id: z.string().regex(/^W-\d+\.\d+-c\d$/),
        /** 1 = hard (a past university exam, a classic textbook problem), 2 = very hard (Putnam, IMC, olympiad) */
        stars: z.union([z.literal(1), z.literal(2)]),
        ...workbookItem,
        /** where the problem comes from; only a source actually opened and read is cited */
        source: z.object({
          name: z.string(),
          year: z.number().int().min(1900),
          problem: z.string(),
          url: z.string().url(),
          /** the day the source was opened; an unquoted YAML date arrives as a Date */
          verified: z.union([
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            z.date().transform((d) => d.toISOString().slice(0, 10)),
          ]),
          /** numbers changed or the claim varied, wording paraphrased in Hebrew */
          adapted: z.boolean().default(true),
        }),
      }),
    ),
  });

/** End-of-chapter summary: what to remember and how to solve the chapter's problems. */
export const summarySchema = z.object({ chapter: z.number().int().min(0).max(11), title: z.string() });
