import type {
  AgentClosetItemCategory,
  SystemRecommendation
} from "@/lib/agents/contracts";

function buildSystemRecommendation(
  id: string,
  category: AgentClosetItemCategory,
  title: string,
  reason: string,
  options?: {
    color?: string;
    fit?: string;
    season?: string[];
    style_tags?: string[];
    image_url?: string;
  }
): SystemRecommendation {
  return {
    id,
    mode: "reference",
    category,
    title,
    color: options?.color,
    fit: options?.fit,
    season: options?.season,
    style_tags: options?.style_tags,
    reason,
    image_url: options?.image_url,
    product: null
  };
}

export const SYSTEM_STYLE_LIBRARY: SystemRecommendation[] = [
  buildSystemRecommendation(
    "sys-top-oxford-shirt",
    "tops",
    "하늘색 옥스퍼드 셔츠",
    "얼굴 주변이 답답하지 않고 대부분의 기본 하의와 연결하기 쉽습니다.",
    {
      color: "하늘색",
      fit: "레귤러",
      season: ["봄", "가을"],
      style_tags: ["clean", "basic"]
    }
  ),
  buildSystemRecommendation(
    "sys-bottom-black-slacks",
    "bottoms",
    "검정 테이퍼드 슬랙스",
    "상의가 달라져도 실루엣이 정리돼서 첫 추천 기준으로 쓰기 좋습니다.",
    {
      color: "검정",
      fit: "테이퍼드",
      season: ["사계절"],
      style_tags: ["clean", "date"]
    }
  ),
  buildSystemRecommendation(
    "sys-shoes-white-sneakers",
    "shoes",
    "화이트 미니멀 스니커즈",
    "무난한 색 조합을 유지하면서도 전체 코디를 가볍게 정리해줍니다.",
    {
      color: "화이트",
      fit: "로우탑",
      season: ["사계절"],
      style_tags: ["basic", "daily"]
    }
  ),
  buildSystemRecommendation(
    "sys-outerwear-navy-blouson",
    "outerwear",
    "네이비 블루종",
    "겉옷이 필요할 때 과하게 튀지 않으면서 상하의를 자연스럽게 묶어줍니다.",
    {
      color: "네이비",
      fit: "세미 루즈",
      season: ["봄", "가을"],
      style_tags: ["clean", "casual"]
    }
  )
];
