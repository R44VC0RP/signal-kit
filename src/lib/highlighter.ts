import { createHighlighter, type Highlighter } from "shiki";

export const SHIKI_THEME = "github-dark-default";

const SUPPORTED_LANGS = [
  "typescript",
  "tsx",
  "javascript",
  "json",
  "html",
  "bash",
] as const;

export type CodeLang = (typeof SUPPORTED_LANGS)[number];

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [SHIKI_THEME],
      langs: [...SUPPORTED_LANGS],
    });
  }
  return highlighterPromise;
}

export async function highlightCode(code: string, lang: CodeLang) {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang,
    theme: SHIKI_THEME,
  });
}
