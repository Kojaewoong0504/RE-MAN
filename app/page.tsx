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
    <main className="app-shell min-h-screen pb-24 pt-4">
      <div className="app-header">
        <p className="app-brand">RE:MAN</p>
        <AccountAccessButton hideWhenSignedOut showProfileLink={false} />
      </div>

      <section className="home-slate-hero mt-5">
        <div className="home-slate-copy">
          <p className="poster-kicker">Style concierge</p>
          <h1>관리 홈</h1>
          <p>오늘 입은 옷과 옷장 기준으로 바로 바꿀 조합을 찾습니다.</p>
          <Link className="home-action-primary" href="/programs/style">
            <span>스타일 체크 시작 →</span>
          </Link>
        </div>
        <div className="home-slate-score" aria-label="오늘의 스타일 점수">
          <span>오늘의 스타일 점수</span>
          <strong>85</strong>
          <small>깔끔한 기본 조합부터 시작</small>
        </div>
        <div className="home-slate-figure">
          <Image
            alt="RE:MAN home visual"
            className="object-cover grayscale"
            fill
            priority
            src={landingHeroImage}
          />
          <div className="home-slate-badge">RE:MEN</div>
        </div>
      </section>

      <section className="home-recommendation">
        <div>
          <p className="poster-kicker">Today</p>
          <h2>오늘의 추천 코스</h2>
        </div>
        <div className="home-course-list">
          <Link href="/programs/style">
            <span>01</span>
            <strong>사진 체크</strong>
          </Link>
          <Link href="/closet">
            <span>02</span>
            <strong>옷장 정리</strong>
          </Link>
          <Link href="/history">
            <span>03</span>
            <strong>기록</strong>
          </Link>
        </div>
      </section>

      <section className="mt-7 space-y-3">
        <div className="section-heading">
          <p className="poster-kicker">Programs</p>
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
