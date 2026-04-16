import Link from "next/link";
import { BottomCTA } from "@/components/common/BottomCTA";

type ComingSoonProgramPageProps = {
  title: string;
  description: string;
  whyItMatters: string;
};

export function ComingSoonProgramPage({
  title,
  description,
  whyItMatters
}: ComingSoonProgramPageProps) {
  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="space-y-6 pt-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Coming Soon</p>
        <h1 className="max-w-sm text-5xl font-bold leading-[0.95] tracking-[-0.04em]">
          {title}
        </h1>
        <p className="max-w-md text-base leading-7 text-stone-700">{description}</p>
        <div className="rounded-[28px] border border-black/10 bg-surface p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Why This Program</p>
          <p className="mt-3 text-lg leading-7 text-ink">{whyItMatters}</p>
        </div>
        <div className="poster-panel grid gap-4 text-sm text-stone-700">
          <p>지금은 스타일 먼저.</p>
          <p>다음 확장 준비 중.</p>
        </div>
      </div>
      <div className="space-y-3 pb-24">
        <Link
          className="block text-center text-sm text-stone-700 underline underline-offset-4"
          href="/programs"
        >
          다른 프로그램으로 돌아가기
        </Link>
        <BottomCTA href="/programs/style" label="스타일 프로그램 먼저 시작하기" />
      </div>
    </main>
  );
}
