import { Link, Outlet, redirect, useLoaderData, useLocation } from "react-router";
import { api } from "../../lib/api";
import { AdminSidebar } from "../../components/admin/AdminSidebar";
import { Icon } from "../../components/ui/Icon";

export async function adminLayoutLoader() {
  const session = await api.session();
  if (!session.ok || !session.data.signedIn) return redirect("/admin/sign-in");
  return { email: session.data.email ?? "admin" };
}

export async function adminLayoutAction({ request }: { request: Request }) {
  const form = await request.formData();
  if (form.get("intent") === "sign-out") {
    await api.signOut();
    return redirect("/admin/sign-in");
  }
  return null;
}

const sectionTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/products": "Products",
  "/admin/inventory": "Inventory",
  "/admin/orders": "Orders",
  "/admin/coupons": "Coupons & rewards",
};

export function AdminLayout() {
  const { email } = useLoaderData() as { email: string };
  const { pathname } = useLocation();
  const title = sectionTitles[pathname.replace(/\/$/, "")] ?? "Admin";

  return (
    <div className="admin">
      <AdminSidebar email={email} />
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__crumbs">
            <span>Admin</span>
            <span><Icon name="chevronRight" size={14} /></span>
            <strong>{title}</strong>
          </div>
          <div className="admin-topbar__actions">
            <Link to="/" className="btn btn--outline btn--sm">
              <Icon name="store" size={16} />
              View store
            </Link>
          </div>
        </header>
        <main className="admin-content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
