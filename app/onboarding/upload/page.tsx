import { BottomCTA } from "@/components/common/BottomCTA";
import { PhotoUploader } from "@/components/upload/PhotoUploader";

export default function UploadPage() {
  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Photo Upload</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          지금 입고 있는 옷 그대로 찍어주세요
        </h1>
        <p className="max-w-sm text-base leading-7 text-zinc-300">
          잘 나올 필요 없습니다. 얼굴 포함 전신, 정면, 자연광이면 충분합니다.
        </p>
      </div>
      <PhotoUploader />
      <BottomCTA href="/onboarding/analyzing" label="AI 분석 시작하기" />
    </main>
  );
}
