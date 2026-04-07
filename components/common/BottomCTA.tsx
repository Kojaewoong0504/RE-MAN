type BottomCTAProps = {
  href: string;
  label: string;
  tone?: "accent" | "default";
};

export function BottomCTA({
  href,
  label,
  tone = "accent"
}: BottomCTAProps) {
  const palette =
    tone === "accent"
      ? "bg-accent text-black"
      : "bg-white/10 text-white ring-1 ring-white/10";

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black to-transparent px-5 pb-5 pt-10">
      <a
        className={`app-shell flex h-14 items-center justify-center rounded-lg text-base font-semibold ${palette}`}
        href={href}
      >
        {label}
      </a>
    </div>
  );
}
