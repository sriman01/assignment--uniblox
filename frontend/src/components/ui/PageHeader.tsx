import type { ReactNode } from "react";
import { Link } from "react-router";
import { Icon } from "./Icon";

export type Crumb = { label: string; to?: string };

type PageHeaderProps = {
  title: ReactNode;
  breadcrumb?: Crumb[];
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, breadcrumb = [], description, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="container page-header__inner">
        {breadcrumb.length > 0 ? (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol>
              {breadcrumb.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`}>
                  {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
                  {index < breadcrumb.length - 1 ? <Icon name="chevronRight" size={14} /> : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="page-header__row">
          <div>
            <h1 className="page-header__title">{title}</h1>
            {description ? <p className="page-header__description">{description}</p> : null}
          </div>
          {actions ? <div className="page-header__actions">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
