import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "success" ? "check" : tone === "error" ? "close" : "sparkle"} size={18} />
      <span>{children}</span>
    </div>
  );
}
