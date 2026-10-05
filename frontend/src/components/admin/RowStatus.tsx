import { Icon } from "../ui/Icon";

type RowStatusProps = {
  saving: boolean;
  data?: { ok?: boolean; error?: string };
};

export function RowStatus({ saving, data }: RowStatusProps) {
  if (saving || !data) return <span className="row-status" />;
  if (data.error) {
    return (
      <span className="row-status row-status--error" title={data.error} role="alert">
        <Icon name="close" size={16} />
        <span className="sr-only">{data.error}</span>
      </span>
    );
  }
  return (
    <span className="row-status" title="Saved" role="status">
      <Icon name="check" size={16} />
      <span className="sr-only">Saved</span>
    </span>
  );
}
