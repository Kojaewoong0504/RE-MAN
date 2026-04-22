import type {
  AgentClosetItemCategory,
  SystemRecommendation
} from "@/lib/agents/contracts";

const SYSTEM_REFERENCE_IMAGE_PATHS = {
  whiteEssentialTshirt: "/system-catalog/tops/white-essential-tshirt.jpg",
  navyPoloKnit: "/system-catalog/tops/navy-polo-knit.jpg",
  stripeOxfordShirt: "/system-catalog/tops/stripe-oxford-shirt.jpg",
  blackTaperedSlacks: "/system-catalog/bottoms/black-tapered-slacks.jpg",
  charcoalWideSlacks: "/system-catalog/bottoms/charcoal-wide-slacks.jpg",
  khakiChinoPants: "/system-catalog/bottoms/khaki-chino-pants.jpg",
  whiteMinimalSneakers: "/system-catalog/shoes/white-minimal-sneakers.svg",
  darkBrownChelseaBoots: "/system-catalog/shoes/dark-brown-chelsea-boots.png",
  blackBlazerJacket: "/system-catalog/outerwear/black-blazer-jacket.jpg",
  beigeClassicCoat: "/system-catalog/outerwear/beige-classic-coat.jpg",
  navyBallcap: "/system-catalog/hats/navy-ballcap.svg",
  blackCrossbag: "/system-catalog/bags/black-crossbag.svg"
} as const;

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
    role?: SystemRecommendation["role"];
    compatibility_tags?: string[];
    layer_order_default?: number;
  }
): SystemRecommendation {
  return {
    id,
    mode: "reference",
    category,
    role: options?.role,
    title,
    color: options?.color,
    fit: options?.fit,
    season: options?.season,
    style_tags: options?.style_tags,
    reason,
    image_url: options?.image_url,
    product: null,
    compatibility_tags: options?.compatibility_tags,
    layer_order_default: options?.layer_order_default
  };
}

export const SYSTEM_STYLE_LIBRARY: SystemRecommendation[] = [
  buildSystemRecommendation(
    "sys-top-oxford-shirt",
    "tops",
    "화이트 에센셜 티셔츠",
    "첫 추천에서도 부담이 적고 대부분의 하의와 바로 연결됩니다.",
    {
      color: "화이트",
      fit: "레귤러",
      season: ["사계절"],
      style_tags: ["clean", "basic", "daily"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.whiteEssentialTshirt,
      role: "base_top",
      compatibility_tags: ["clean", "starter"],
      layer_order_default: 10
    }
  ),
  buildSystemRecommendation(
    "sys-top-navy-polo",
    "tops",
    "네이비 폴로 니트",
    "티셔츠보다 조금 더 정돈된 인상을 주면서도 과하지 않습니다.",
    {
      color: "네이비",
      fit: "레귤러",
      season: ["봄", "여름", "가을"],
      style_tags: ["clean", "date"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.navyPoloKnit,
      role: "mid_top",
      compatibility_tags: ["clean", "date"],
      layer_order_default: 20
    }
  ),
  buildSystemRecommendation(
    "sys-top-stripe-shirt",
    "tops",
    "스트라이프 셔츠",
    "밋밋한 기본 조합에서 벗어나고 싶을 때 가장 안전하게 변화를 줍니다.",
    {
      color: "블루 스트라이프",
      fit: "레귤러",
      season: ["봄", "가을"],
      style_tags: ["clean", "smart-casual"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.stripeOxfordShirt,
      role: "base_top",
      compatibility_tags: ["clean", "smart-casual"],
      layer_order_default: 10
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
      style_tags: ["clean", "date"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.blackTaperedSlacks,
      role: "bottom",
      compatibility_tags: ["clean", "starter"],
      layer_order_default: 40
    }
  ),
  buildSystemRecommendation(
    "sys-bottom-charcoal-wide",
    "bottoms",
    "차콜 와이드 슬랙스",
    "상체가 단순할 때도 하체 실루엣으로 전체 밸런스를 잡아줍니다.",
    {
      color: "차콜",
      fit: "와이드",
      season: ["사계절"],
      style_tags: ["clean", "modern"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.charcoalWideSlacks,
      role: "bottom",
      compatibility_tags: ["clean", "modern"],
      layer_order_default: 40
    }
  ),
  buildSystemRecommendation(
    "sys-bottom-khaki-chino",
    "bottoms",
    "카키 치노 팬츠",
    "검정 하의보다 부드럽게 보이면서도 캐주얼한 만남에 쓰기 쉽습니다.",
    {
      color: "카키",
      fit: "레귤러",
      season: ["봄", "가을"],
      style_tags: ["casual", "daily"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.khakiChinoPants,
      role: "bottom",
      compatibility_tags: ["casual", "daily"],
      layer_order_default: 40
    }
  ),
  buildSystemRecommendation(
    "sys-shoes-white-minimal-sneakers",
    "shoes",
    "화이트 미니멀 스니커즈",
    "무난한 색 조합을 유지하면서도 전체 코디를 가볍게 정리해줍니다.",
    {
      color: "화이트",
      fit: "로우탑",
      season: ["사계절"],
      style_tags: ["clean", "starter"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.whiteMinimalSneakers,
      role: "shoes",
      compatibility_tags: ["clean", "starter"],
      layer_order_default: 50
    }
  ),
  buildSystemRecommendation(
    "sys-shoes-brown-chelsea-boots",
    "shoes",
    "다크 브라운 첼시 부츠",
    "슬랙스나 코트 조합에서 전체 분위기를 빠르게 성숙하게 정리해줍니다.",
    {
      color: "다크 브라운",
      fit: "첼시 부츠",
      season: ["가을", "겨울", "봄"],
      style_tags: ["clean", "date", "smart-casual"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.darkBrownChelseaBoots,
      role: "shoes",
      compatibility_tags: ["clean", "smart-casual"],
      layer_order_default: 50
    }
  ),
  buildSystemRecommendation(
    "sys-outerwear-navy-blouson",
    "outerwear",
    "블랙 블레이저",
    "기본 티셔츠나 셔츠 위에 걸쳤을 때 가장 빠르게 정돈된 인상을 만듭니다.",
    {
      color: "블랙",
      fit: "테일러드",
      season: ["봄", "가을", "겨울"],
      style_tags: ["clean", "formal"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.blackBlazerJacket,
      role: "outerwear",
      compatibility_tags: ["clean", "formal"],
      layer_order_default: 30
    }
  ),
  buildSystemRecommendation(
    "sys-outerwear-beige-coat",
    "outerwear",
    "베이지 클래식 코트",
    "너무 무겁지 않게 분위기를 바꾸고 싶을 때 가장 쓰기 쉬운 겉옷입니다.",
    {
      color: "베이지",
      fit: "클래식",
      season: ["가을", "겨울"],
      style_tags: ["clean", "date"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.beigeClassicCoat,
      role: "outerwear",
      compatibility_tags: ["clean", "date"],
      layer_order_default: 30
    }
  ),
  buildSystemRecommendation(
    "sys-hat-navy-ballcap",
    "hats",
    "네이비 볼캡",
    "얼굴선을 가볍게 정리하고 캐주얼한 외출 느낌을 더해줍니다.",
    {
      color: "네이비",
      fit: "볼캡",
      season: ["사계절"],
      style_tags: ["daily", "casual"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.navyBallcap,
      role: "addon",
      compatibility_tags: ["daily"],
      layer_order_default: 60
    }
  ),
  buildSystemRecommendation(
    "sys-bag-black-crossbag",
    "bags",
    "블랙 크로스백",
    "소지품 정리와 함께 전체 코디를 더 완성된 외출 느낌으로 묶어줍니다.",
    {
      color: "블랙",
      fit: "크로스백",
      season: ["사계절"],
      style_tags: ["daily", "clean"],
      image_url: SYSTEM_REFERENCE_IMAGE_PATHS.blackCrossbag,
      role: "addon",
      compatibility_tags: ["daily", "clean"],
      layer_order_default: 70
    }
  )
];
