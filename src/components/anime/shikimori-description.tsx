import type { ReactNode } from "react";

const ENTITY_URLS = {
  anime: "animes",
  character: "characters",
  manga: "mangas",
  person: "people",
} as const;

type ShikimoriEntity = keyof typeof ENTITY_URLS;

function isShikimoriEntity(value: string): value is ShikimoriEntity {
  return value in ENTITY_URLS;
}

/** Renders Shikimori BBCode references as safe, readable links. */
export function ShikimoriDescription({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const referencePattern = /\[(anime|character|manga|person)=(\d+)(?:\s[^\]]*)?\]([\s\S]*?)\[\/\1\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = referencePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [, entity, id, label] = match;
    if (isShikimoriEntity(entity)) {
      nodes.push(
        <a
          key={`${entity}-${id}-${match.index}`}
          href={`https://shikimori.one/${ENTITY_URLS[entity]}/${id}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent underline decoration-accent/35 underline-offset-4 transition-colors hover:text-foreground"
        >
          {label}
        </a>,
      );
    } else {
      nodes.push(match[0]);
    }

    lastIndex = referencePattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted">{nodes}</p>;
}
