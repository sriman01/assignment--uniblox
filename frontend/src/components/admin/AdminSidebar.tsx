import { Form, NavLink } from "react-router";
import { Icon, type IconName } from "../ui/Icon";

const links: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: "/admin", label: "Dashboard", icon: "chart", end: true },
  { to: "/admin/products", label: "Products", icon: "tag" },
  { to: "/admin/inventory", label: "Inventory", icon: "warehouse" },
  { to: "/admin/orders", label: "Orders", icon: "receipt" },
  { to: "/admin/coupons", label: "Coupons & rewards", icon: "gift" },
];

export function AdminSidebar({ email }: { email: string }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <span className="logo__mark">A</span>
        <div>
          <strong>Assignment</strong>
          <span>Admin console</span>
        </div>
      </div>

      <nav className="admin-nav" aria-label="Admin">
        <span className="admin-nav__label">Manage</span>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end}>
            <Icon name={link.icon} size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar__footer">
        <div className="admin-user">
          <span className="avatar">{email.slice(0, 1)}</span>
          <div>
            <strong>Store admin</strong>
            <span>{email}</span>
          </div>
        </div>
        <Form method="post" action="/admin">
          <button className="btn btn--sm btn--signout" type="submit" name="intent" value="sign-out">
            <Icon name="logout" size={16} />
            Sign out
          </button>
        </Form>
      </div>
    </aside>
  );
}
