import type { ReactNode } from "react";

export function HeroWash({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <div className={className}>{children}</div>;
}
