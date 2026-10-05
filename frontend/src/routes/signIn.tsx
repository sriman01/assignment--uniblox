import { Form, Link, redirect, useActionData, useNavigation, useSearchParams } from "react-router";
import { Alert } from "../components/ui/Alert";
import { Icon } from "../components/ui/Icon";
import { api } from "../lib/api";
import { safeRedirectPath } from "../lib/redirect";

export async function signInLoader({ request }: { request: Request }) {
  const session = await api.customerSession();
  if (session.ok && session.data.signedIn) {
    return redirect(safeRedirectPath(new URL(request.url).searchParams.get("redirectTo"), "/account"));
  }
  return null;
}

export async function signInAction({ request }: { request: Request }) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const result = await api.customerSignIn(email, password);
  if (!result.ok) {
    return { error: result.error.message };
  }
  return redirect(safeRedirectPath(form.get("redirectTo"), "/account"));
}

export function SignInPage() {
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get("redirectTo"), "/account");
  const submitting = navigation.state === "submitting";

  return (
    <div className="login-page">
      <div className="login-page__banner">
        <div>
          <h1>Let’s get <span>cosy</span>.</h1>
          <p>Sign in to your Assignment account to check out and track everything you’ve ordered.</p>
        </div>
        <ul className="login-page__perks">
          <li><Icon name="receipt" />Track every order and receipt</li>
          <li><Icon name="gift" />See the coupons your purchases earn</li>
          <li><Icon name="shield" />Safe checkout that never charges twice</li>
        </ul>
      </div>

      <div className="login-page__form-container">
        <div className="login-page__form-box">
          <span className="logo__mark">A</span>
          <h2>Sign in</h2>
          <p>{redirectTo === "/checkout" ? "Sign in to continue to checkout." : "Welcome back. Enter your details below."}</p>
          <div className="demo-credentials">
            <strong>Demo customer</strong>
            <code>maya@assignment.test</code>
            <code>sleepwell</code>
          </div>
          <Form method="post">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="field">
              <span className="field__label">Email address</span>
              <input className="input" name="email" type="email" autoComplete="username" defaultValue="maya@assignment.test" required autoFocus />
            </label>
            <label className="field">
              <span className="field__label">Password</span>
              <input className="input" name="password" type="password" autoComplete="current-password" defaultValue="sleepwell" required />
            </label>
            {actionData?.error ? <Alert tone="error">{actionData.error}</Alert> : null}
            <button className="btn btn--accent btn--block" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </Form>
          <div className="login-page__footer-links">
            <p>New here? <Link to={`/register?redirectTo=${encodeURIComponent(redirectTo)}`}>Create an account</Link></p>
            <p>Just browsing? <Link to="/products">Continue shopping</Link></p>
            <p>Store staff? <Link to="/admin/sign-in">Admin sign in</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
