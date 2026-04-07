import { BottomCTA } from "@/components/common/BottomCTA";

export default function LandingPage() {
  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="poster-grid pt-10">
        <p className="text-xs uppercase tracking-[0.28em] text-accent">RE:MAN</p>
        <div className="space-y-6">
          <h1 className="max-w-sm text-5xl font-bold leading-[0.95] tracking-[-0.04em]">
            지금 모습 그대로, 1주일만 맡겨봐
          </h1>
          <p className="max-w-xs text-base leading-7 text-zinc-300">
            판단 없이, AI가 사진 한 장에서 시작해서 오늘 입을 수 있는 변화만 집어줍니다.
          </p>
        </div>
        <div className="grid gap-4 border-t border-white/10 pt-6 text-sm text-zinc-300">
          <p>회원가입 없이 시작</p>
          <p>설문 3개만 답변</p>
          <p>사진 업로드 실패 시 텍스트 대체 가능</p>
        </div>
      </div>
      <BottomCTA href="/onboarding/survey" label="지금 시작하기" />
    </main>
  );
}
