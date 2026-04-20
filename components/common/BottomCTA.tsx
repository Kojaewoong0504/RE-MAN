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
  const palette = tone === "accent" ? "ui-button-accent" : "ui-button-secondary";
  const className = `${disabled ? "pointer-events-none" : "pointer-events-auto"} ${palette} h-14 w-full max-w-[440px] text-base ${
    disabled ? "cursor-not-allowed opacity-40" : "active:translate-y-px"
  }`;

  return (
    <div className="bottom-cta-bar">
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
