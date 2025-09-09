// app/create/pack/mock.ts
import { Pack, Section } from "./types";

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

/**
 * Generate a mock pack outline from prompt + focus/range
 */
export function generateMockPack(prompt: string, range = "weekly", focus = "General"): Promise<Pack> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const baseTitle = `${prompt || "Untitled Pack"} — ${capitalize(range)} Pack`;
      const sections: Section[] = [
        {
          id: uid("s"),
          title: `${capitalize(range)} Overview — ${focus}`,
          body: `Short summary about **${prompt}** focused on ${focus}. Use this to introduce the pack.`,
          kind: "explanation",
        },
        {
          id: uid("s"),
          title: "Top Headlines",
          body: "1. Headline A\n2. Headline B\n3. Headline C",
          kind: "headlines",
        },
        {
          id: uid("s"),
          title: "Context & Why It Matters",
          body: "A concise explanation linking the headlines to exam-relevant concepts.",
          kind: "explanation",
        },
        {
          id: uid("s"),
          title: "Vocabulary",
          body: "1. Bandwidth — amount of data that can be transmitted.\n2. Protocol — rules that govern communication.",
          kind: "vocab",
        },
        {
          id: uid("s"),
          title: "Quick Quiz",
          body: "1. Which protocol is connectionless? (a) TCP (b) UDP (c) HTTP\nAnswer: b",
          kind: "quiz",
        },
      ];

      resolve({
        id: uid("p"),
        title: baseTitle,
        focus,
        range: range as 'weekly' | 'monthly',
        tags: [focus, "CurrentAffairs"],
        visibility: "private",
        sections,
        created_at: new Date().toISOString(),
      });
    }, 700);
  });
}

/**
 * Generate 3 MCQs from text (mock)
 */
export function mockQuizFromText(text: string, count = 3) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const quiz = Array.from({ length: count }).map((_, i) => ({
        prompt: `Mock question ${i + 1} derived from text.`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: "Option A",
      }));
      resolve({ quiz });
    }, 800);
  });
}

function capitalize(s: string) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}
