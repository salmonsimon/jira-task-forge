import { Fragment, type ReactNode } from "react";

export function AssistedDescriptionMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(
      <p className="mb-4 text-sm leading-relaxed text-[#dfe1e6]" key={`p-${blocks.length}`}>
        {renderInlineLines(paragraph, `p-${blocks.length}`)}
      </p>
    );
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        className={`${list.ordered ? "list-decimal" : "list-disc"} mb-4 space-y-1 pl-5 text-sm leading-relaxed text-[#dfe1e6]`}
        key={`list-${blocks.length}`}
      >
        {list.items.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  }

  function flushCode() {
    if (!code) return;
    blocks.push(
      <pre className="mb-4 overflow-x-auto rounded border border-[#454852] bg-[#1f2126] p-3 text-xs leading-relaxed text-[#dfe1e6]" key={`code-${blocks.length}`}>
        <code>{code.join("\n")}</code>
      </pre>
    );
    code = null;
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (code) {
        flushCode();
      } else {
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(line);
      continue;
    }

    const heading = line.match(/^(#{3,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push(
        <h4 className="mb-2 mt-5 text-sm font-semibold text-[#f4f5f7]" key={`h-${blocks.length}`}>
          {renderInlineMarkdown(heading[2], `h-${blocks.length}`)}
        </h4>
      );
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const orderedList = Boolean(ordered);
      if (!list || list.ordered !== orderedList) {
        flushList();
        list = { ordered: orderedList, items: [] };
      }
      list.items.push((unordered?.[1] ?? ordered?.[1] ?? "").trim());
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();

  return <div>{blocks}</div>;
}

function renderInlineLines(lines: string[], keyPrefix: string) {
  return lines.map((line, index) => (
    <Fragment key={`${keyPrefix}-${index}`}>
      {renderInlineMarkdown(line, `${keyPrefix}-${index}`)}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function renderInlineMarkdown(value: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|(https?:\/\/[^\s<]+))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));

    const [raw, , linkText, linkHref, boldA, boldB, inlineCode, rawUrl] = match;
    const href = linkHref ?? rawUrl;
    const boldText = boldA ?? boldB;

    if (href) {
      const cleanHref = href.replace(/[.,;:!?]+$/, "");
      const trailing = href.slice(cleanHref.length);
      if (isSafeHref(cleanHref)) {
        nodes.push(
          <a
            className="text-[#85b8ff] underline decoration-[#85b8ff]/50 underline-offset-2 hover:text-[#cce0ff]"
            href={cleanHref}
            key={`${keyPrefix}-link-${match.index}`}
            rel="noreferrer"
            target="_blank"
          >
            {linkText ?? cleanHref}
          </a>
        );
        if (trailing) nodes.push(trailing);
      } else {
        nodes.push(linkText ?? raw);
      }
    } else if (boldText) {
      nodes.push(
        <strong className="font-semibold text-[#f4f5f7]" key={`${keyPrefix}-strong-${match.index}`}>
          {boldText}
        </strong>
      );
    } else if (inlineCode) {
      nodes.push(
        <code className="rounded bg-[#1f2126] px-1 py-0.5 text-xs text-[#cce0ff]" key={`${keyPrefix}-code-${match.index}`}>
          {inlineCode}
        </code>
      );
    } else {
      nodes.push(raw);
    }

    cursor = match.index + raw.length;
  }

  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href);
}
