"use client";

import Image from "next/image";
import Link from "next/link";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";

const landingHeroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAapHX97qtDFt-KUOu4pgfWrOt-skAndFIM5NXu2yZgsBHO5Q1_49WKz0B2vPaZWBEcUDvFYX1af513roA3ct3qaA7dmKKYn78VJXwSaye9YnJza5d5t17nVfthn61t6iYUxqRbgSnIay2xjfj6PbrOqernDHCDIkHoC5NnK01kYSyxG56NMouPrxJ0jqIEG6onY1XrO7o4fGXBrBNWgtX7NPjSi0Muo3f3Yw1bNzmxyC1oF3NfANDXhMn2J2ptBpRRioiz5SPoRtd7";

const featureTiles = [
  {
    label: "스타일",
    sublabel: "사진 체크",
    mark: "ST",
    href: "/programs/style"
  },
  {
    label: "옷장",
    sublabel: "사진 등록",
    mark: "CL",
    href: "/closet"
  },
  {
    label: "추천",
    sublabel: "준비 중",
    mark: "RC"
  },
  {
    label: "이벤트",
    sublabel: "준비 중",
    mark: "EV"
  },
  {
    label: "헤어",
    sublabel: "준비 중",
    mark: "HR",
    href: "/programs/hair"
  },
  {
    label: "피부",
    sublabel: "준비 중",
    mark: "SK",
    href: "/programs/skin"
  }
];

export default function LandingPage() {
  return (
    <main className="app-shell min-h-screen pb-24 pt-6">
      <div className="app-header">
        <p className="app-brand">RE:MAN</p>
        <AccountAccessButton />
      </div>

      <section className="home-hero mt-5">
        <div className="relative aspect-[1/1]">
          <Image
            alt="RE:MAN home visual"
            className="h-full w-full object-cover grayscale"
            fill
            priority
            src={landingHeroImage}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-[var(--color-bg)]">
            <p className="poster-kicker text-[var(--color-bg)]/65">RE:MAN HOME</p>
            <h1 className="mt-3 text-[46px] font-black leading-[0.9] tracking-[-0.07em]">
              관리 홈
            </h1>
            <p className="mt-3 text-sm font-black text-[var(--color-bg)]/80">
              사진, 옷장, 추천을 한 곳에서.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <Link className="home-action-primary" href="/programs/style">
          <span>스타일 체크 시작</span>
          <span>→</span>
        </Link>
      </section>

      <section className="mt-7 space-y-3">
        <div className="section-heading">
          <p className="poster-kicker">Quick</p>
          <h2>바로가기</h2>
        </div>
        <div className="home-quick-grid">
          {featureTiles.map((tile) =>
            tile.href ? (
              <Link className="home-icon-card" href={tile.href} key={tile.label}>
                <span className="home-icon-mark">{tile.mark}</span>
                <span className="home-icon-label">{tile.label}</span>
                <span className="home-icon-sub">{tile.sublabel}</span>
              </Link>
            ) : (
              <div
                aria-disabled="true"
                className="home-icon-card home-icon-card-disabled"
                key={tile.label}
              >
                <span className="home-icon-mark">{tile.mark}</span>
                <span className="home-icon-label">{tile.label}</span>
                <span className="home-icon-sub">{tile.sublabel}</span>
              </div>
            )
          )}
        </div>
      </section>

      <section className="mt-7 home-strip">
        <div>
          <p className="poster-kicker">Next</p>
          <p>상품 추천과 이벤트는 이 영역에 붙입니다.</p>
        </div>
        <Link href="/programs">전체 보기</Link>
      </section>
    </main>
  );
}
