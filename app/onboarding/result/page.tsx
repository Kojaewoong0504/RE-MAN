import { BottomCTA } from "@/components/common/BottomCTA";
import { FeedbackFlow } from "@/components/feedback/FeedbackFlow";

export default function ResultPage() {
  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-8">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">First Feedback</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          첫 피드백은 칭찬보다 방향을 먼저 줍니다
        </h1>
      </div>
      <FeedbackFlow
        closingLabel="Day 1 미션"
        diagnosis="지금 코디는 편안함 위주라 인상은 무난하지만, 핏과 레이어가 약해서 스타일 의도가 잘 안 보입니다."
        improvements={[
          "바지 핏을 조금 더 곧게 잡으면 전체 인상이 훨씬 정리돼 보여요.",
          "티셔츠 위에 얇은 셔츠나 자켓 하나만 더해도 단조로운 느낌이 줄어요.",
          "신발 톤을 상의나 하의 중 하나와 맞추면 코디가 덜 흩어져 보여요."
        ]}
        todayAction="지금 가진 옷 중 가장 깔끔한 상의와 바지를 한 번 다시 조합해서 거울로 비교해보세요."
      />
      <BottomCTA href="/day/1" label="Day 1 미션 시작하기" />
    </main>
  );
}
