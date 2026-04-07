type FeedbackCardProps = {
  label: string;
  body: string;
  accent?: boolean;
};

export function FeedbackCard({
  label,
  body,
  accent = false
}: FeedbackCardProps) {
  return (
    <section
      className={`rounded-xl p-5 ${accent ? "bg-accent text-black" : "bg-surface text-white"}`}
    >
      <p className={`mb-3 text-xs uppercase tracking-[0.22em] ${accent ? "text-black/70" : "text-muted"}`}>
        {label}
      </p>
      <p className="text-lg leading-7">{body}</p>
    </section>
  );
}
