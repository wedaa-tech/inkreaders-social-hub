// app/components/feed/helpers.tsx
export function extractImages(embed: any): string[] {
  if (!embed) return [];
  if (embed?.$type === "app.bsky.embed.images#view" && Array.isArray(embed.images)) {
    return embed.images.map((im: any) => im?.thumb || im?.full || "").filter(Boolean);
  }
  if (embed?.$type === "app.bsky.embed.recordWithMedia#view" && embed.media) {
    return extractImages(embed.media);
  }
  return [];
}

export function extractExternal(embed: any) {
  if (!embed) return undefined;
  if (embed?.$type === "app.bsky.embed.external#view" && embed.external?.uri) {
    const e = embed.external;
    return { uri: e.uri, title: e.title, description: e.description, thumb: e.thumb };
  }
  if (embed?.$type === "app.bsky.embed.recordWithMedia#view" && embed.media) {
    return extractExternal(embed.media);
  }
  return undefined;
}

// very simple autolink (URLs only)
export function renderTextWithLinks(text?: string) {
  if (!text) return null;
  const parts = text.split(/(\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+)/gi);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part) || /^www\./i.test(part)) {
      const href = /^https?:\/\//i.test(part) ? part : `https://${part}`;
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer"
           className="text-[color:var(--color-brand)] hover:underline break-words">
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
