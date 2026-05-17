import { type CodeLang, highlightCode } from "@/lib/highlighter";

type Props = {
  filename: string;
  code: string;
  lang: CodeLang;
};

export async function CodeBlock({ filename, code, lang }: Props) {
  const html = await highlightCode(code, lang);
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 font-mono text-sm text-neutral-100 shadow-sm shadow-violet-200/40 ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5 text-xs tracking-wide text-neutral-400 uppercase">
        <span>{filename}</span>
        <span aria-hidden="true">•••</span>
      </div>
      <div
        className="overflow-x-auto p-5 text-sm leading-6 [&_pre]:m-0 [&_pre]:bg-transparent! [&_pre]:p-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

type StaticProps = {
  filename: string;
  html: string;
};

export function CodeBlockStatic({ filename, html }: StaticProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 font-mono text-sm text-neutral-100 shadow-sm shadow-violet-200/40 ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5 text-xs tracking-wide text-neutral-400 uppercase">
        <span>{filename}</span>
        <span aria-hidden="true">•••</span>
      </div>
      <div
        className="overflow-x-auto p-5 text-sm leading-6 [&_pre]:m-0 [&_pre]:bg-transparent! [&_pre]:p-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
