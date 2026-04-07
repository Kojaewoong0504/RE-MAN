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
      ? "bg-accent text-black"
      : "bg-white/10 text-white ring-1 ring-white/10";
  const className = `${disabled ? "pointer-events-none" : "pointer-events-auto"} flex h-14 w-full max-w-[480px] items-center justify-center rounded-lg text-base font-semibold transition ${palette} ${
    disabled ? "cursor-not-allowed opacity-40" : ""
  }`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black to-transparent px-5 pb-5 pt-10">
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
