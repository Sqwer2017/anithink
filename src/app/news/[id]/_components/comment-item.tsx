import Image from "next/image";
import {
  buildUserAvatarUrl,
  getCommentBodyHtml,
  type Comment,
} from "@/lib/api/shikimori";

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Один комментарий в стиле AniThink. */
export function CommentItem({ comment }: { comment: Comment }) {
  const avatar = buildUserAvatarUrl(comment.user);
  const bodyHtml = getCommentBodyHtml(comment);
  const date = formatDate(comment.created_at);
  const edited = comment.updated_at && comment.updated_at !== comment.created_at;
  const editedDate = edited ? formatDate(comment.updated_at) : null;

  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface/40 p-4 transition-colors hover:border-accent/25">
      {/* Аватар */}
      {avatar ? (
        <Image
          src={avatar}
          alt={comment.user?.nickname || ""}
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
          unoptimized
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-accent">
          {(comment.user?.nickname || "?").charAt(0).toUpperCase()}
        </span>
      )}

      {/* Тело */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-foreground">
            {comment.user?.nickname || "Аноним"}
          </span>
          {date && <span className="text-xs text-muted">{date}</span>}
          {edited && editedDate && (
            <span className="text-[11px] text-muted/60">(ред. {editedDate})</span>
          )}
          {comment.is_offtopic && (
            <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-bold text-yellow-500">
              оффтоп
            </span>
          )}
        </div>

        {/* HTML-контент комментария */}
        {bodyHtml ? (
          <div
            className="prose-cyber mt-2 text-sm"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="mt-2 text-sm text-muted">—</p>
        )}
      </div>
    </div>
  );
}