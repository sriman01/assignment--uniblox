import { Form, redirect, useActionData, useNavigation } from "react-router";
import { api } from "../api";

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
  return (
    <main className="wrap">
      <section className="sign-in">
        <p className="eyebrow">SleepyHug operations</p>
        <h1>Admin sign in</h1>
        <p className="note">Manage products, stock, orders, rewards, and sales reporting.</p>
        <div className="demo">
          <strong>Demo admin</strong>
          <div>admin@sleepyhug.test</div>
          <div>sleepyhug</div>
        </div>
        <Form method="post">
          <label className="field">
            Email
            <input name="email" type="email" defaultValue="admin@sleepyhug.test" required />
          </label>
          <label className="field">
            Password
            <input name="password" type="password" defaultValue="sleepyhug" required />
          </label>
          {actionData?.error ? <p className="error">{actionData.error}</p> : null}
          <button className="btn btn-full" disabled={navigation.state !== "idle"}>
            {navigation.state === "idle" ? "Sign in" : "Signing in…"}
          </button>
        </Form>
      </section>
    </main>
  );
}
