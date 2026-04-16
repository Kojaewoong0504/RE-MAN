"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: React.ReactNode;
};

function HomeIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M4 10.5 12 4l8 6.5V20H5.5v-7H4v-2.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 20v-5h5v5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function StyleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M8 4h8l2 4-2 12H8L6 8l2-4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 8h6M10 12h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ClosetIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M6 5h12v15H6V5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 5v15M9 10h.01M15 10h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M12 6v6l4 2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c1.2-3.2 3.5-5 7-5s5.8 1.8 7 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

const tabs: TabItem[] = [
  {
    href: "/",
    label: "홈",
    match: (pathname) => pathname === "/",
    icon: <HomeIcon />
  },
  {
    href: "/programs/style",
    label: "스타일",
    match: (pathname) => pathname.startsWith("/programs/style") || pathname.startsWith("/onboarding"),
    icon: <StyleIcon />
  },
  {
    href: "/closet",
    label: "옷장",
    match: (pathname) => pathname.startsWith("/closet"),
    icon: <ClosetIcon />
  },
  {
    href: "/history",
    label: "기록",
    match: (pathname) => pathname.startsWith("/history"),
    icon: <HistoryIcon />
  },
  {
    href: "/profile",
    label: "내 정보",
    match: (pathname) => pathname.startsWith("/profile") || pathname.startsWith("/settings"),
    icon: <ProfileIcon />
  }
];

function shouldHideTabNav(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/dev") ||
    pathname.includes("/analyzing")
  );
}

export function BottomTabNav() {
  const pathname = usePathname();

  if (shouldHideTabNav(pathname)) {
    return null;
  }

  return (
    <nav className="bottom-tab-nav" aria-label="주요 메뉴">
      <div className="bottom-tab-nav-inner">
        {tabs.map((tab) => {
          const active = tab.match(pathname);

          return (
            <Link
              key={tab.href}
              aria-current={active ? "page" : undefined}
              className={`bottom-tab-item ${active ? "bottom-tab-item-active" : ""}`}
              href={tab.href}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
