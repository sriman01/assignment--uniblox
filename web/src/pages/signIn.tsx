import { Form, redirect, useActionData, useNavigation } from "react-router";
import { api } from "../api";

export async function signInLoader() {
  const session = await api.customerSession();
  if (session.ok && session.data.signedIn) {
    return redirect("/account");
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
  return redirect("/account");
}

export function SignInPage() {
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();

  return (
    <section className="sign-in">
      <p className="eyebrow">Customer account</p>
      <h1>Sign in</h1>
      <p className="note">Sign in to check out, track your orders, and see coupons earned by your purchases.</p>
      <div className="demo">
        <strong>Demo customer</strong>
        <div>maya@sleepyhug.test</div>
        <div>sleepwell</div>
      </div>
      <Form method="post">
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="username" defaultValue="maya@sleepyhug.test" required />
        </label>
        <label className="field">
          Password
          <input name="password" type="password" autoComplete="current-password" defaultValue="sleepwell" required />
        </label>
        {actionData?.error ? <p className="error">{actionData.error}</p> : null}
        <button className="btn btn-full" type="submit" disabled={navigation.state !== "idle"}>
          {navigation.state !== "idle" ? "Signing in…" : "Sign in"}
        </button>
      </Form>
    </section>
  );
}
