import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { Alert } from "../components/ui/Alert";
import { Icon } from "../components/ui/Icon";
import { api } from "../lib/api";

export async function adminSignInLoader() {
  const session = await api.session();
  return session.ok && session.data.signedIn ? redirect("/admin") : null;
}

export async function adminSignInAction({ request }: { request: Request }) {
  const form = await request.formData();
  const result = await api.signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  return result.ok ? redirect("/admin") : { error: result.error.message };
}

export function AdminSignInPage() {
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <div className="login-page login-page--standalone">
      <div className="login-page__banner">
        <div>
          <h1>Run the <span>store</span>.</h1>
          <p>Manage prices, stock, orders, and milestone rewards from one place.</p>
        </div>
        <ul className="login-page__perks">
          <li><Icon name="chart" />Sales and discount reporting</li>
          <li><Icon name="warehouse" />Live inventory controls</li>
          <li><Icon name="gift" />Configurable coupon milestones</li>
        </ul>
      </div>

      <div className="login-page__form-container">
        <div className="login-page__form-box">
          <span className="logo__mark">A</span>
          <h2>Admin sign in</h2>
          <p>Assignment operations console</p>
          <div className="demo-credentials">
            <strong>Demo admin</strong>
            <code>admin@assignment.test</code>
            <code>assignment</code>
          </div>
          <Form method="post">
            <label className="field">
              <span className="field__label">Email address</span>
              <input className="input" name="email" type="email" autoComplete="username" defaultValue="admin@assignment.test" required autoFocus />
            </label>
            <label className="field">
              <span className="field__label">Password</span>
              <input className="input" name="password" type="password" autoComplete="current-password" defaultValue="assignment" required />
            </label>
            {actionData?.error ? <Alert tone="error">{actionData.error}</Alert> : null}
            <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </Form>
          <div className="login-page__footer-links">
            <p><Link to="/">Back to the store</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
