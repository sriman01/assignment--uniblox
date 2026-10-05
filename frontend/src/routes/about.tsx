import { Link } from "react-router";
import { ProductImage } from "../components/store/ProductImage";
import { Icon, type IconName } from "../components/ui/Icon";

const values: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: "sparkle", title: "Considered materials", text: "Natural fibres chosen for comfort, breathability, and longevity." },
  { icon: "tag", title: "Honest pricing", text: "Live prices until checkout, and a receipt that never changes after." },
  { icon: "shield", title: "Reliable checkout", text: "Retries are safe. You are never charged twice for one order." },
  { icon: "gift", title: "Real rewards", text: "Milestone orders earn coupons you can apply on your next purchase." },
];

const showcase = [
  "11111111-1111-4111-8111-111111111111",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "22222222-2222-4222-8222-222222222222",
];

export function AboutPage() {
  return (
    <>
      <section className="banner">
        <div className="container banner__inner">
          <span className="eyebrow">About us</span>
          <h1>Comfort, made thoughtfully.</h1>
          <p>Assignment is a small sleep and home store built around a simple promise: what you see is what you pay, and every order is handled exactly once.</p>
        </div>
      </section>

      <section className="container section split">
        <div>
          <span className="eyebrow">Our story</span>
          <h2>Better rest starts with the basics</h2>
          <p>We started with a short list of things everyone sleeps with every night: a good blanket, crisp sheets, the right pillow. Then we made sure buying them was just as calm.</p>
          <p>Stock is live, so we never sell what we don’t have. Prices are captured on your receipt the moment you order. And every few orders a signed-in shopper places earns them a coupon of their own.</p>
          <div className="hero__actions" style={{ marginTop: 24 }}>
            <Link to="/products" className="btn btn--primary">Shop the collection</Link>
            <Link to="/contact" className="btn btn--outline">Get in touch</Link>
          </div>
        </div>
        <div className="mosaic" aria-hidden="true">
          {showcase.map((id) => <ProductImage key={id} productId={id} name="" />)}
        </div>
      </section>

      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">What we stand for</span>
            <h2>Our values</h2>
          </div>
        </div>
        <div className="values-grid">
          {values.map((value) => (
            <div className="card value-card" key={value.title}>
              <span className="usp__icon"><Icon name={value.icon} size={22} /></span>
              <h3>{value.title}</h3>
              <p>{value.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="stats-band">
          <div><strong>6</strong><span>Carefully chosen products</span></div>
          <div><strong>0</strong><span>Double charges, by design</span></div>
          <div><strong>100%</strong><span>Orders with frozen receipts</span></div>
          <div><strong>Free</strong><span>Shipping on every order</span></div>
        </div>
      </section>

      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="cta-band">
          <div>
            <h2>Ready for a better night?</h2>
            <p>Browse the collection and start earning milestone rewards.</p>
          </div>
          <Link to="/products" className="btn btn--accent btn--lg">Shop now <Icon name="arrowRight" size={18} /></Link>
        </div>
      </section>
    </>
  );
}
