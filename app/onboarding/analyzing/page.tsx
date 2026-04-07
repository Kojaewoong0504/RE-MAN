const steps = [
  "핏을 분석하는 중...",
  "컬러 밸런스 확인 중...",
  "개선 포인트 정리 중..."
];

export default function AnalyzingPage() {
  return (
    <main className="app-shell flex min-h-screen flex-col justify-center gap-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.28em] text-accent">Analyzing</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          AI가 지금 스타일의 출발점을 읽고 있어요
        </h1>
      </div>
      <div className="grid gap-3">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`rounded-xl px-4 py-4 text-base ${
              index === steps.length - 1 ? "bg-accent text-black" : "bg-surface text-white"
            }`}
          >
            {step}
          </div>
        ))}
      </div>
      <a className="text-sm text-muted underline underline-offset-4" href="/onboarding/result">
        데모 결과 보기
      </a>
    </main>
  );
}
