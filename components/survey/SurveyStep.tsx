type SurveyOption = {
  label: string;
};

type SurveyStepProps = {
  title: string;
  caption: string;
  options: SurveyOption[];
};

export function SurveyStep({ title, caption, options }: SurveyStepProps) {
  return (
    <section className="space-y-6 rounded-2xl bg-surface/80 p-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Survey</p>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm leading-6 text-zinc-300">{caption}</p>
      </div>
      <div className="grid gap-3">
        {options.map((option) => (
          <button
            key={option.label}
            className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-left text-base text-white transition hover:border-accent/60"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
