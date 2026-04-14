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
      className={`border-2 p-5 ${
        accent ? "border-black bg-accent text-black" : "border-black bg-[#fcf8ef] text-ink"
      }`}
    >
      <p
        className={`mb-3 text-xs uppercase tracking-[0.22em] ${
          accent ? "text-black/70" : "text-muted"
        }`}
      >
        {label}
      </p>
      <p className="whitespace-pre-line text-[18px] font-semibold leading-7 tracking-tight">
        {body}
      </p>
    </section>
  );
}
