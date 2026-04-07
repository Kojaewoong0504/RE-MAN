import Link from "next/link";

type BottomCTAProps = {
  href?: string;
  label: string;
  tone?: "accent" | "default";
  disabled?: boolean;
  onClick?: () => void;
};

export function BottomCTA({
  href,
  label,
  tone = "accent",
  disabled = false,
  onClick
}: BottomCTAProps) {
  const palette =
    tone === "accent"
      ? "bg-accent text-black border-black"
      : "bg-[#fcf8ef] text-ink border-black";
  const className = `${disabled ? "pointer-events-none" : "pointer-events-auto"} flex h-14 w-full max-w-[440px] items-center justify-center border-2 text-base font-black tracking-tight transition ${palette} ${
    disabled ? "cursor-not-allowed opacity-40" : "active:translate-y-px"
  }`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center border-t border-black/10 bg-[rgba(252,248,239,0.92)] px-5 pb-5 pt-4 backdrop-blur-md">
      {href && !disabled ? (
        <Link className={className} href={href}>
          {label}
        </Link>
      ) : (
        <button
          className={className}
          disabled={disabled}
          onClick={onClick}
          type="button"
        >
          {label}
        </button>
      )}
    </div>
  );
}
