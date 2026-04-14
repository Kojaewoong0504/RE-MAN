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
      className={accent ? "ui-panel-accent" : "ui-panel"}
    >
      <p
        className={`mb-3 text-xs uppercase tracking-[0.22em] ${
          accent ? "text-[var(--color-accent-ink)]/70" : "text-muted"
        }`}
      >
        {label}
      </p>
      <p className="whitespace-pre-line text-[17px] font-semibold leading-7 tracking-tight">
        {body}
      </p>
    </section>
  );
}
