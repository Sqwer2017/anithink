import { MessageCircle } from "lucide-react";
import type { Comment } from "@/lib/api/shikimori";
import { CommentForm } from "@/app/news/[id]/_components/comment-form";
import { CommentItem } from "@/app/news/[id]/_components/comment-item";

export function AnimeCommentsSection({
  comments,
  totalCount,
}: {
  comments: Comment[];
  totalCount: number;
}) {
  return (
    <section className="mt-12 max-w-[1320px]">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <MessageCircle className="h-6 w-6 text-accent" />
          Комментарии
          <span className="rounded-lg bg-accent/15 px-2 py-0.5 text-sm font-bold text-accent">
            {totalCount}
          </span>
        </h2>
      </div>

      <CommentForm subjectLabel="аниме" />

      <div className="mt-8 space-y-4">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 py-12 text-center">
            <MessageCircle className="mb-3 h-8 w-8 text-muted/40" />
            <p className="text-sm text-muted">Пока нет комментариев. Будьте первым!</p>
          </div>
        ) : (
          comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)
        )}
      </div>
    </section>
  );
}
