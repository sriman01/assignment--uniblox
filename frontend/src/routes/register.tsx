import { Form, Link, redirect, useActionData, useNavigation, useSearchParams } from "react-router";
import { Alert } from "../components/ui/Alert";
import { Icon } from "../components/ui/Icon";
import { api } from "../lib/api";
import { safeRedirectPath } from "../lib/redirect";

export async function registerLoader({ request }: { request: Request }) {
  const session = await api.customerSession();
  if (session.ok && session.data.signedIn) {
    return redirect(safeRedirectPath(new URL(request.url).searchParams.get("redirectTo"), "/account"));
  }
  return null;
}

export async function registerAction({ request }: { request: Request }) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirmPassword") ?? "")) {
    return { error: "The two passwords do not match." };
  }
  const result = await api.customerRegister({
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    password,
  });
  if (!result.ok) {
    return { error: result.error.message };
  }
  return redirect(safeRedirectPath(form.get("redirectTo"), "/account"));
}

export function RegisterPage() {
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get("redirectTo"), "/account");
  const submitting = navigation.state === "submitting";

  return (
    <div className="login-page">
      <div className="login-page__banner">
        <div>
          <h1>Join and <span>earn</span>.</h1>
          <p>Create an account and every order you place counts toward your own reward coupons.</p>
        </div>
        <ul className="login-page__perks">
          <li><Icon name="gift" />A discount coupon for every few orders you place</li>
          <li><Icon name="receipt" />Order history and receipts in one place</li>
          <li><Icon name="heart" />Save favourites to your wishlist</li>
        </ul>
      </div>

      <div className="login-page__form-container">
        <div className="login-page__form-box">
          <span className="logo__mark">A</span>
          <h2>Create your account</h2>
          <p>It takes less than a minute.</p>
          <Form method="post">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="field">
              <span className="field__label">Full name</span>
              <input className="input" name="name" autoComplete="name" maxLength={80} required autoFocus />
            </label>
            <label className="field">
              <span className="field__label">Email address</span>
              <input className="input" name="email" type="email" autoComplete="email" required />
            </label>
            <label className="field">
              <span className="field__label">Password</span>
              <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
              <span className="field__hint">At least 8 characters.</span>
            </label>
            <label className="field">
              <span className="field__label">Confirm password</span>
              <input className="input" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
            </label>
            {actionData?.error ? <Alert tone="error">{actionData.error}</Alert> : null}
            <button className="btn btn--accent btn--block" type="submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </Form>
          <div className="login-page__footer-links">
            <p>Already have an account? <Link to={`/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`}>Sign in</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
