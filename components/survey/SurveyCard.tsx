"use client";

type SurveyCardProps = {
  title: string;
  caption: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

export function SurveyCard({
  title,
  caption,
  options,
  value,
  onChange
}: SurveyCardProps) {
  return (
    <section className="space-y-6 rounded-2xl bg-surface/80 p-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Survey</p>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm leading-6 text-zinc-300">{caption}</p>
      </div>
      <div className="grid gap-3">
        {options.map((option) => {
          const isActive = value === option;

          return (
            <button
              key={option}
              className={`min-h-12 rounded-xl border px-4 py-4 text-left text-base text-white transition ${
                isActive
                  ? "border-accent bg-accent/15"
                  : "border-white/10 bg-black/20 hover:border-accent/60"
              }`}
              onClick={() => onChange(option)}
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}
