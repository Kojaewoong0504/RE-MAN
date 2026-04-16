import Image from "next/image";
import Link from "next/link";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";

type ProgramCard = {
  href: string;
  title: string;
  description: string;
  status: string;
  icon: string;
  featured?: boolean;
  image?: string;
};

const programs: ProgramCard[] = [
  {
    href: "/programs/style",
    title: "스타일",
    description: "사진과 옷장으로 조합 추천",
    status: "지금 시작 가능",
    icon: "스타일",
    featured: true,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBXjlr_phAUclWIJo-qkMkFcmG3zCIdjIpsiMEM_ErBTrpJOH-9U0xs06cqtEyPgfvTPl9g46VApTGSEmu3l3G_vFT6CiJ4U84tj7KRzXqZZzjGMIrGd989FODL3dN9SCwyu_kUsMYyw6VYnwyrAHNdloZSBQrmrBGuIFcKODC-l8IyenNIcrqa27f_SG8fl9wwNgwP4kPz84bUSkUQIglmp3-B61ohSe7wVMf4g3LlkLBZ5CPzO7llJ1VCVxbnCZhQvU9_U5Ry8gfj"
  },
  {
    href: "/programs/hair",
    title: "헤어",
    description: "얼굴형 기준 방향",
    status: "준비 중",
    icon: "헤어"
  },
  {
    href: "/programs/body",
    title: "체형/자세",
    description: "자세와 비율 정리",
    status: "준비 중",
    icon: "체형"
  },
  {
    href: "/programs/skin",
    title: "피부",
    description: "최소 관리 루틴",
    status: "준비 중",
    icon: "피부"
  }
];

export default function ProgramsPage() {
  const featuredProgram = programs[0]!;
  const queuedPrograms = programs.slice(1);

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-5 pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <span className="text-lg">≡</span>
            <p className="app-brand">RE:MAN</p>
          </div>
          <AccountAccessButton />
        </div>
        <section className="screen-hero">
          <p className="poster-kicker">Programs</p>
          <h1 className="screen-title">관리의 시작점을 하나씩 고릅니다</h1>
          <p className="screen-copy">지금은 스타일부터.</p>
        </section>
      </div>
      <section className="space-y-5">
        <p className="poster-kicker">Available Now</p>
        <Link
          className="work-surface block overflow-hidden transition active:translate-y-px"
          href={featuredProgram.href}
        >
          <div className="relative">
            <Image
              alt="스타일 프로그램 대표 이미지"
              className="aspect-video w-full object-cover grayscale"
              height={560}
              src={featuredProgram.image!}
              width={840}
            />
            <div className="absolute left-4 top-4 bg-[var(--color-ink)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-bg)]">
              {featuredProgram.status}
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="poster-kicker">MVP</p>
                <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-ink">
                  {featuredProgram.title}
                </h2>
              </div>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-ink">
                {featuredProgram.icon}
              </span>
            </div>
            <p className="text-base font-semibold leading-7 text-muted">
              {featuredProgram.description}
            </p>
          </div>
          <div className="metric-strip grid-cols-3 border-x-0 border-b-0 text-center">
            {["사진 진단", "옷장 조합", "피드백 저장"].map((item) => (
              <span
                key={item}
                className="metric-cell text-xs font-black text-ink"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="border-t border-black/15 p-4 text-base font-black">
            프로그램 시작하기
          </div>
        </Link>
        <div className="action-rail">
          {queuedPrograms.map((program) => (
            <Link
              key={program.title}
              className="action-row"
              href={program.href}
            >
              <div>
                <span className="text-base font-black">{program.title}</span>
                <p className="mt-1 text-xs font-bold leading-5 text-muted">
                  {program.description}
                </p>
              </div>
              <span className="text-xs font-black uppercase tracking-[0.14em] text-muted">
                {program.status}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="work-surface-quiet p-5 pb-28">
        <p className="poster-kicker">Expansion</p>
        <p className="mt-3 text-sm font-black leading-6 text-ink">
          사이즈, 헤어, 피부, 향수는 이후 확장.
        </p>
      </section>
    </main>
  );
}
