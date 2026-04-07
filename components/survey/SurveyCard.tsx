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
    <section className="space-y-6 border-t-2 border-black pt-5">
      <div className="space-y-3">
        <p className="poster-kicker">Survey</p>
        <h2 className="text-[34px] font-black leading-[1.04] tracking-[-0.05em] text-ink">
          {title}
        </h2>
        <p className="max-w-md text-[15px] font-medium leading-7 text-muted">{caption}</p>
      </div>
      <div className="grid gap-2.5">
        {options.map((option) => {
          const isActive = value === option;

          return (
            <button
              key={option}
              className={`min-h-[64px] border-2 px-4 py-4 text-left text-[16px] font-bold tracking-tight text-ink transition ${
                isActive
                  ? "border-black bg-accent"
                  : "border-[#111111] bg-[#fcf8ef] hover:-translate-y-0.5"
              }`}
              onClick={() => onChange(option)}
              type="button"
            >
              <div className="flex items-center justify-between gap-4">
                <span>{option}</span>
                <span className="text-sm">{isActive ? "선택됨" : "→"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
