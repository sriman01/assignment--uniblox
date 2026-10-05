import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={30} />
      </span>
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__message">{message}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
