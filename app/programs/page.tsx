import Image from "next/image";
import Link from "next/link";

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
    description: "지금 가진 옷에서 시작하는 7일 스타일 코칭",
    status: "지금 시작 가능",
    icon: "스타일",
    featured: true,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBXjlr_phAUclWIJo-qkMkFcmG3zCIdjIpsiMEM_ErBTrpJOH-9U0xs06cqtEyPgfvTPl9g46VApTGSEmu3l3G_vFT6CiJ4U84tj7KRzXqZZzjGMIrGd989FODL3dN9SCwyu_kUsMYyw6VYnwyrAHNdloZSBQrmrBGuIFcKODC-l8IyenNIcrqa27f_SG8fl9wwNgwP4kPz84bUSkUQIglmp3-B61ohSe7wVMf4g3LlkLBZ5CPzO7llJ1VCVxbnCZhQvU9_U5Ry8gfj"
  },
  {
    href: "/programs/hair",
    title: "헤어",
    description: "지금 얼굴형과 분위기에 맞는 변화 방향을 제안",
    status: "준비 중",
    icon: "헤어"
  },
  {
    href: "/programs/body",
    title: "체형/자세",
    description: "인상이 달라 보이도록 서 있는 방식부터 정리",
    status: "준비 중",
    icon: "체형"
  },
  {
    href: "/programs/skin",
    title: "피부",
    description: "복잡한 루틴보다 당장 가능한 관리부터 시작",
    status: "준비 중",
    icon: "피부"
  }
];

export default function ProgramsPage() {
  const featuredProgram = programs[0]!;
  const queuedPrograms = programs.slice(1);

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <span className="text-lg">≡</span>
            <p className="text-sm font-black tracking-tight text-ink">RE:MAN</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-[#f1eadb] text-sm font-bold">
            R
          </div>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Determination</p>
        <h1 className="text-[38px] font-black leading-[1.05] tracking-[-0.05em] text-ink">
          종이 위에 적는
          <br />
          당신의 첫 변화.
        </h1>
        <div className="inline-block border-2 border-black bg-accent px-4 py-3">
          <span className="text-base font-black text-black">신규 방문자: Day 0</span>
        </div>
      </div>
      <section className="space-y-5">
        <p className="text-lg font-black tracking-tight text-ink">변화 프로그램</p>
        <Link
          className="block border-2 border-black bg-[#fcf8ef] p-5 transition hover:-translate-y-0.5"
          href={featuredProgram.href}
        >
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
                {featuredProgram.status}
              </p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-ink">
                {featuredProgram.title}
              </h2>
            </div>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-ink">
              {featuredProgram.icon}
            </span>
          </div>
          <div className="mb-4 overflow-hidden border-2 border-black">
            <Image
              alt="스타일 프로그램 대표 이미지"
              className="aspect-video w-full object-cover grayscale"
              height={560}
              src={featuredProgram.image!}
              width={840}
            />
          </div>
          <p className="mb-5 text-base font-medium leading-7 text-muted">
            {featuredProgram.description}
          </p>
          <div className="w-full bg-black py-4 text-center text-base font-bold text-[#fcf8ef] transition hover:bg-accent hover:text-black">
            프로그램 시작하기
          </div>
        </Link>
        <div className="grid grid-cols-2 gap-4">
          {queuedPrograms.slice(0, 2).map((program) => (
            <Link
              key={program.title}
              className="flex min-h-[180px] flex-col justify-between border-2 border-black bg-[#fcf8ef] p-4"
              href={program.href}
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-bold text-ink">{program.icon}</span>
                <span className="bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#fcf8ef]">
                  {program.status}
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-[-0.04em] text-ink">{program.title}</h3>
                <p className="mt-2 text-xs font-medium leading-5 text-muted">
                  {program.description}
                </p>
              </div>
            </Link>
          ))}
          <Link
            className="col-span-2 flex items-center justify-between border-2 border-black bg-[#fcf8ef] p-4"
            href={queuedPrograms[2].href}
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-ink">{queuedPrograms[2].icon}</span>
              <div>
                <h3 className="text-2xl font-black tracking-[-0.04em] text-ink">
                  {queuedPrograms[2].title}
                </h3>
                <p className="mt-1 text-xs font-medium leading-5 text-muted">
                  {queuedPrograms[2].description}
                </p>
              </div>
            </div>
            <span className="bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#fcf8ef]">
              {queuedPrograms[2].status}
            </span>
          </Link>
        </div>
      </section>
      <section className="rotate-[1deg] border-2 border-black bg-accent p-5 pb-28">
        <p className="text-lg font-black tracking-tight text-black">시작 팁</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-black">
          첫 진단은 3분이면 충분합니다. 지금 스타일 프로그램을 시작해 당신의 잠재력을
          확인하세요.
        </p>
      </section>
    </main>
  );
}
