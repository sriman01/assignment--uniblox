import { Form, useActionData, useNavigation } from "react-router";
import { Alert } from "../components/ui/Alert";
import { Icon, type IconName } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";

type ContactResult = { sent: true; name: string } | { sent: false; error: string };

export async function contactAction({ request }: { request: Request }): Promise<ContactResult> {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  if (!name || !email || !message) {
    return { sent: false, error: "Please complete your name, email, and message." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { sent: false, error: "Please enter a valid email address." };
  }
  return { sent: true, name };
}

const channels: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: "mail", title: "Email", text: "hello@assignment.test — we reply within one business day." },
  { icon: "phone", title: "Phone", text: "+1 (555) 010-2030, Monday to Friday, 9am–6pm." },
  { icon: "receipt", title: "Order help", text: "Include your order number from the receipt so we can find it fast." },
];

export function ContactPage() {
  const result = useActionData() as ContactResult | undefined;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <>
      <PageHeader
        title="Contact us"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Contact us" }]}
        description="Questions about a product, an order, or a coupon? Send us a message and we’ll get back to you."
      />
      <div className="container section contact-layout">
        <div className="contact-cards">
          {channels.map((channel) => (
            <div className="card contact-card" key={channel.title}>
              <span className="usp__icon"><Icon name={channel.icon} size={22} /></span>
              <div>
                <strong>{channel.title}</strong>
                <p>{channel.text}</p>
              </div>
            </div>
          ))}
        </div>

        <section className="card">
          <div className="card__header"><h2>Send a message</h2></div>
          <div className="card__body">
            {result?.sent ? (
              <Alert tone="success">Thanks, {result.name}. Your message has been received.</Alert>
            ) : null}
            {result && !result.sent ? <Alert tone="error">{result.error}</Alert> : null}
            <Form method="post" key={result?.sent ? "sent" : "form"}>
              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Name</span>
                  <input className="input" name="name" autoComplete="name" required />
                </label>
                <label className="field">
                  <span className="field__label">Email</span>
                  <input className="input" name="email" type="email" autoComplete="email" required />
                </label>
              </div>
              <label className="field">
                <span className="field__label">Subject</span>
                <select className="select" name="subject" defaultValue="order">
                  <option value="order">Order question</option>
                  <option value="product">Product question</option>
                  <option value="coupon">Coupons &amp; rewards</option>
                  <option value="other">Something else</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Message</span>
                <textarea className="textarea" name="message" rows={5} required />
              </label>
              <button className="btn btn--accent" type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send message"}
              </button>
            </Form>
          </div>
        </section>
      </div>
    </>
  );
}
