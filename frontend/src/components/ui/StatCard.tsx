import { Icon, type IconName } from "./Icon";

type StatCardProps = {
  label: string;
  value: string;
  icon: IconName;
  hint?: string;
};

export function StatCard({ label, value, icon, hint }: StatCardProps) {
  return (
    <div className="stat-card">
      <span className="stat-card__icon">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <span className="stat-card__label">{label}</span>
        <strong className="stat-card__value">{value}</strong>
        {hint ? <span className="stat-card__hint">{hint}</span> : null}
      </div>
    </div>
  );
}
