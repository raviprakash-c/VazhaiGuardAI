import { Bot, User, Volume2 } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  text: string;
  onSpeak?: () => void;
  isSpeaking?: boolean;
}

/**
 * Model responses can occasionally be encoded more than once, for example
 * `&amp;#xBA4;` instead of the Tamil character itself. Decode repeatedly so
 * the farmer sees real Tamil Unicode rather than HTML entity text.
 */
function decodeHtmlEntities(text: string): string {
  if (!text || typeof document === "undefined") return text;

  let decoded = text;
  for (let pass = 0; pass < 3; pass += 1) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = decoded;
    const next = textarea.value;
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

function cleanInline(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderText(text: string) {
  const lines = decodeHtmlEntities(text).replace(/\r/g, "").split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const trimmed = cleanInline(line);

        if (!trimmed) {
          return <div key={`space-${index}`} className="h-1" />;
        }

        const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
        const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
        const content = bullet?.[1] ?? numbered?.[1] ?? trimmed;

        if (bullet) {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
              <span>{content}</span>
            </div>
          );
        }

        if (numbered) {
          return (
            <div key={index} className="flex gap-2">
              <span className="font-semibold opacity-80">
                {trimmed.slice(0, trimmed.indexOf(content))}
              </span>
              <span>{content}</span>
            </div>
          );
        }

        return <p key={index}>{trimmed}</p>;
      })}
    </div>
  );
}

export default function ChatMessage({
  role,
  text,
  onSpeak,
  isSpeaking = false,
}: ChatMessageProps) {
  const assistant = role === "assistant";

  return (
    <div className={`flex gap-3 ${assistant ? "justify-start" : "justify-end"}`}>
      {assistant && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#b8df4b]">
          <Bot className="h-4 w-4 text-[#073b2a]" />
        </div>
      )}

      <div
        className={`group relative max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          assistant
            ? "rounded-bl-md border border-[#dce9e0] bg-white pr-11 text-[#13271d]"
            : "rounded-br-md bg-[#073b2a] text-white"
        }`}
      >
        {renderText(text)}

        {assistant && onSpeak && (
          <button
            type="button"
            onClick={onSpeak}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-[#146c43] opacity-60 transition hover:bg-[#eaf5ec] hover:opacity-100"
            aria-label="Replay response"
            title="Replay response"
          >
            <Volume2 className={`h-4 w-4 ${isSpeaking ? "animate-pulse" : ""}`} />
          </button>
        )}
      </div>

      {!assistant && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0eb]">
          <User className="h-4 w-4 text-[#146c43]" />
        </div>
      )}
    </div>
  );
}
