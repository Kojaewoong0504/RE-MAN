import { BottomCTA } from "@/components/common/BottomCTA";

type DayPageProps = {
  params: {
    n: string;
  };
};

export default function DayPage({ params }: DayPageProps) {
  const day = Number(params.n);

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Day {day}</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          오늘 미션 하나만 끝내면 됩니다
        </h1>
        <p className="max-w-sm text-base leading-7 text-zinc-300">
          Day {day} 페이지는 이후 실제 미션 데이터와 피드백 이력 연결이 들어갈 자리입니다.
        </p>
      </div>
      <section className="rounded-2xl bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Mission</p>
        <p className="mt-4 text-lg leading-7">
          지금 가진 옷 기준으로 오늘 해야 할 행동 한 가지만 보여주는 구조를 유지합니다.
        </p>
      </section>
      <BottomCTA href="/onboarding/upload" label="오늘 사진 다시 올리기" />
    </main>
  );
}
