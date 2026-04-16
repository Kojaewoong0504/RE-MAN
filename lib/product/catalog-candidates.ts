import type { SizeCandidate } from "@/lib/product/size-candidates";

type ProductCategory = "tops" | "bottoms" | "shoes";

type CatalogItem = {
  id: string;
  category: ProductCategory;
  title: string;
  sizes: string[];
  fit: string;
  useCase: string;
  keywords: string[];
};

export type ProductCatalogCandidate = {
  id: string;
  category: ProductCategory;
  label: string;
  title: string;
  size: string;
  fit: string;
  reason: string;
  checkPoint: string;
};

const categoryLabels: Record<ProductCategory, string> = {
  tops: "상의 후보",
  bottoms: "하의 후보",
  shoes: "신발 후보"
};

const internalCatalog: CatalogItem[] = [
  {
    id: "top-oxford-regular",
    category: "tops",
    title: "레귤러 옥스포드 셔츠",
    sizes: ["M", "L", "XL"],
    fit: "레귤러",
    useCase: "무지 티셔츠보다 단정한 첫 업그레이드",
    keywords: ["셔츠", "상의", "비즈니스", "소개팅", "단정"]
  },
  {
    id: "top-heavy-tee",
    category: "tops",
    title: "탄탄한 무지 티셔츠",
    sizes: ["M", "L", "XL"],
    fit: "세미 레귤러",
    useCase: "후드티와 얇은 티셔츠 사이의 기본템",
    keywords: ["티셔츠", "무지", "상의", "주말", "기본"]
  },
  {
    id: "bottom-tapered-slacks",
    category: "bottoms",
    title: "테이퍼드 슬랙스",
    sizes: ["30", "31", "32", "33", "34"],
    fit: "테이퍼드",
    useCase: "청바지보다 정돈된 인상을 만들 때",
    keywords: ["슬랙스", "하의", "비즈니스", "소개팅", "단정"]
  },
  {
    id: "bottom-straight-denim",
    category: "bottoms",
    title: "진청 스트레이트 데님",
    sizes: ["30", "31", "32", "33", "34"],
    fit: "스트레이트",
    useCase: "평소 청바지 기반을 유지하면서 핏만 정리할 때",
    keywords: ["청바지", "데님", "하의", "주말", "기본"]
  },
  {
    id: "shoe-white-sneaker",
    category: "shoes",
    title: "화이트 레더 스니커즈",
    sizes: ["260", "265", "270", "275", "280"],
    fit: "기본 발볼",
    useCase: "대부분의 기본 조합을 깔끔하게 마무리할 때",
    keywords: ["스니커즈", "신발", "화이트", "흰색", "기본"]
  },
  {
    id: "shoe-black-loafer",
    category: "shoes",
    title: "블랙 로퍼",
    sizes: ["260", "265", "270", "275", "280"],
    fit: "기본 발볼",
    useCase: "캐주얼을 조금 더 어른스럽게 보이게 할 때",
    keywords: ["로퍼", "신발", "검정", "비즈니스", "단정"]
  }
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getCatalogScore(item: CatalogItem, referenceItem: string, styleGoal: string | undefined) {
  const referenceText = normalizeText(referenceItem);
  const goalText = normalizeText(styleGoal ?? "");

  return item.keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    const referenceScore = referenceText.includes(normalizedKeyword) ? 3 : 0;
    const goalScore = goalText.includes(normalizedKeyword) ? 1 : 0;

    return score + referenceScore + goalScore;
  }, 0);
}

function findCatalogItem(candidate: SizeCandidate, styleGoal: string | undefined) {
  const categoryItems = internalCatalog.filter(
    (item) => item.category === candidate.category && item.sizes.includes(candidate.size)
  );

  if (categoryItems.length === 0) {
    return null;
  }

  return categoryItems
    .map((item) => ({
      item,
      score: getCatalogScore(item, candidate.referenceItem, styleGoal)
    }))
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))[0]
    .item;
}

export function buildProductCatalogCandidates(input: {
  sizeCandidates: SizeCandidate[];
  styleGoal?: string;
}): ProductCatalogCandidate[] {
  return input.sizeCandidates.flatMap((candidate) => {
    const item = findCatalogItem(candidate, input.styleGoal);

    if (!item) {
      return [];
    }

    return [
      {
        id: item.id,
        category: item.category,
        label: categoryLabels[item.category],
        title: item.title,
        size: candidate.size,
        fit: item.fit,
        reason: `${candidate.referenceItem} 기준으로 ${candidate.size}부터 확인할 내부 카탈로그 후보입니다. ${item.useCase}.`,
        checkPoint: candidate.checkPoint
      }
    ];
  });
}
