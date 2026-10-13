import type { MessagePart } from "@/lib/events/types";

/**
 * A chat message with emotes inline, as Twitch shows it: emote images sized to the line,
 * animated emotes animate, zero-width emotes (7TV/BTTV) sit on top of the emote before them,
 * and cheermotes show their tier image followed by the bits amount in the tier colour.
 */
export function MessageText({ text, parts, className }: { text: string | null; parts?: MessagePart[]; className?: string }) {
  if (!parts?.length) {
    return text ? <span className={className}>{text}</span> : null;
  }
  const nodes: React.ReactNode[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.type === "text") {
      nodes.push(<span key={index}>{part.text}</span>);
    } else if (part.type === "mention") {
      nodes.push(
        <span key={index} className="sko-mention">
          {part.text}
        </span>,
      );
    } else if (part.type === "cheer") {
      nodes.push(
        <span key={index} className="sko-cheer">
          <Emote url={part.url} name={part.name} />
          <span className="sko-cheer-bits" style={{ color: part.color }}>
            {part.bits}
          </span>
        </span>,
      );
    } else {
      // Collect any zero-width emotes that follow, and stack them on this one.
      const overlays: MessagePart[] = [];
      while (parts[index + 1]?.type === "emote" && (parts[index + 1] as Extract<MessagePart, { type: "emote" }>).zeroWidth) {
        overlays.push(parts[index + 1]);
        index += 1;
      }
      nodes.push(
        overlays.length > 0 ? (
          <span key={index} className="sko-emote-stack">
            <Emote url={part.url} name={part.name} />
            {overlays.map((overlay, n) => (overlay.type === "emote" ? <Emote key={n} url={overlay.url} name={overlay.name} zeroWidth /> : null))}
          </span>
        ) : (
          <Emote key={index} url={part.url} name={part.name} />
        ),
      );
    }
  }
  return <span className={className}>{nodes}</span>;
}

function Emote({ url, name, zeroWidth = false }: { url: string; name: string; zeroWidth?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={zeroWidth ? "sko-emote sko-emote-zw" : "sko-emote"} src={url} alt={name} title={name} referrerPolicy="no-referrer" loading="eager" />;
}
