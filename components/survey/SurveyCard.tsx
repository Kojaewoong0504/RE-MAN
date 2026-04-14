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
    <section className="ui-section">
      <div className="space-y-2">
        <p className="poster-kicker">Style Check</p>
        <h2 className="text-[27px] font-black leading-[1.08] tracking-[-0.05em] text-ink">
          {title}
        </h2>
        <p className="max-w-md text-[14px] font-medium leading-6 text-muted">{caption}</p>
      </div>
      <div className="grid gap-2">
        {options.map((option) => {
          const isActive = value === option;

          return (
            <button
              key={option}
              aria-pressed={isActive}
              className={`ui-choice min-h-[56px] text-[15px] ${isActive ? "ui-choice-selected" : ""}`}
              onClick={() => onChange(option)}
              type="button"
            >
              <div className="flex items-center justify-between gap-4">
                <span>{option}</span>
                <span className="text-xs">{isActive ? "선택됨" : "선택"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
