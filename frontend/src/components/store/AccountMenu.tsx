import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import type { Customer } from "../../types";
import { Icon } from "../ui/Icon";
import { useDismiss } from "./useDismiss";

type AccountMenuProps = {
  customer: Customer | null;
};

export function AccountMenu({ customer }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const signIn = useFetcher<{ error?: string }>();
  const signOut = useFetcher();
  const close = useCallback(() => setOpen(false), []);
  const here = `${location.pathname}${location.search}`;
  useDismiss(root, open, close);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, customer?.id]);

  return (
    <div className="account-menu" ref={root}>
      <button
        type="button"
        className="indicator"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="indicator__icon">
          <Icon name="user" size={22} />
        </span>
        <span className="indicator__label">
          <small>{customer ? "Hello," : "Welcome"}</small>
          <strong>{customer ? customer.name.split(" ")[0] : "Sign in"}</strong>
        </span>
      </button>
      <div
        className="dropdown account-menu__panel"
        role="dialog"
        aria-label="Account"
        data-open={open}
        aria-hidden={!open}
        inert={!open}
      >
          {customer ? (
            <>
              <div className="account-menu__profile">
                <span className="avatar">{customer.name.slice(0, 1)}</span>
                <div>
                  <strong>{customer.name}</strong>
                  <small>{customer.email}</small>
                </div>
              </div>
              <nav className="account-menu__links">
                <Link to="/account"><Icon name="receipt" size={18} />My orders</Link>
                <Link to="/account#coupons"><Icon name="gift" size={18} />My coupons</Link>
                <Link to="/wishlist"><Icon name="heart" size={18} />Wishlist</Link>
                <Link to="/cart"><Icon name="cart" size={18} />Cart</Link>
              </nav>
              <signOut.Form method="post" action="/account">
                <input type="hidden" name="redirectTo" value={here} />
                <button type="submit" className="btn btn--outline btn--block" disabled={signOut.state !== "idle"}>
                  <Icon name="logout" size={18} />
                  {signOut.state !== "idle" ? "Signing out…" : "Sign out"}
                </button>
              </signOut.Form>
            </>
          ) : (
            <signIn.Form method="post" action="/sign-in" className="account-menu__form">
              <h3>Sign in to your account</h3>
              <p className="muted">Track orders, check out faster, and see coupons you have earned.</p>
              <input type="hidden" name="redirectTo" value={here} />
              <label className="field">
                <span className="field__label">Email</span>
                <input className="input" name="email" type="email" autoComplete="username" defaultValue="maya@assignment.test" required />
              </label>
              <label className="field">
                <span className="field__label">Password</span>
                <input className="input" name="password" type="password" autoComplete="current-password" defaultValue="sleepwell" required />
              </label>
              {signIn.data?.error ? <p className="form-error">{signIn.data.error}</p> : null}
              <button type="submit" className="btn btn--accent btn--block" disabled={signIn.state !== "idle"}>
                {signIn.state !== "idle" ? "Signing in…" : "Sign in"}
              </button>
              <p className="account-menu__hint">
                New here? <Link to={`/register?redirectTo=${encodeURIComponent(here)}`}>Create an account</Link>
              </p>
              <p className="account-menu__hint">Demo: maya@assignment.test / sleepwell</p>
            </signIn.Form>
          )}
      </div>
    </div>
  );
}
