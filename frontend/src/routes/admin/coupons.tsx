import { Form, useActionData, useFetcher, useLoaderData, useNavigation, type ActionFunctionArgs } from "react-router";
import { api, unwrap } from "../../lib/api";
import { RowStatus } from "../../components/admin/RowStatus";
import { Alert } from "../../components/ui/Alert";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { StatCard } from "../../components/ui/StatCard";
import type { Coupon, CustomerRewardSummary, SalesReport, StoreConfig } from "../../types";
import { uuidFromString, type Uuid } from "../../typeDefinitions";

type ActionResult = { ok?: true; message?: string; error?: string };

export async function couponsLoader() {
  const [coupons, config, report, customers] = await Promise.all([
    api.coupons(),
    api.config(),
    api.report(),
    api.customers(),
  ]);
  return {
    coupons: unwrap(coupons).items,
    config: unwrap(config),
    report: unwrap(report),
    customers: unwrap(customers).items,
  };
}

function optionalCustomerId(value: FormDataEntryValue | null): Uuid | null {
  const text = String(value ?? "");
  return text ? uuidFromString(text) : null;
}

export async function couponsAction({ request }: ActionFunctionArgs): Promise<ActionResult> {
  const form = await request.formData();
  const intent = form.get("intent");
  const code = String(form.get("code") ?? "");

  if (intent === "update-config") {
    const result = await api.updateConfig({
      everyNthOrder: Number(form.get("everyNthOrder")),
      discountPercent: Number(form.get("discountPercent")),
    });
    return result.ok ? { ok: true, message: "Reward settings saved. New coupons will use these values." } : { error: result.error.message };
  }
  if (intent === "create-coupon") {
    const result = await api.createCoupon({
      code: code.trim() || undefined,
      percentOff: Number(form.get("percentOff")),
      customerId: optionalCustomerId(form.get("customerId")),
    });
    return result.ok ? { ok: true, message: `Created coupon ${result.data.code}.` } : { error: result.error.message };
  }
  if (intent === "update-coupon") {
    const result = await api.updateCoupon(code, {
      percentOff: Number(form.get("percentOff")),
      customerId: optionalCustomerId(form.get("customerId")),
      status: form.get("status") === "disabled" ? "disabled" : "available",
    });
    return result.ok ? { ok: true } : { error: result.error.message };
  }
  if (intent === "delete-coupon") {
    const result = await api.deleteCoupon(code);
    return result.ok ? { ok: true } : { error: result.error.message };
  }
  const customerId = optionalCustomerId(form.get("customerId"));
  const result = await api.generateCoupon(customerId ?? undefined);
  return result.ok ? { ok: true, message: `Generated ${result.data.code}.` } : { error: result.error.message };
}

export function CouponsRoute() {
  const { coupons, config, report, customers } = useLoaderData() as {
    coupons: Coupon[];
    config: StoreConfig;
    report: SalesReport;
    customers: CustomerRewardSummary[];
  };
  const actionData = useActionData() as ActionResult | undefined;
  const navigation = useNavigation();
  const busyIntent = navigation.state !== "idle" ? navigation.formData?.get("intent") : null;
  const eligible = customers.filter((customer) => customer.eligibleMilestone !== null);
  const sortedCustomers = [...customers].sort(
    (a, b) => Number(b.eligibleMilestone !== null) - Number(a.eligibleMilestone !== null) || b.ordersPlaced - a.ordersPlaced,
  );
  const sortedCoupons = [...coupons].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Coupons &amp; rewards</h1>
          <p>
            Each customer earns a {config.discountPercent}% coupon for every {config.everyNthOrder} of their own orders.
            Only orders from signed-in customers count. You can also create, edit, pause, or delete coupons yourself.
          </p>
        </div>
      </div>

      {actionData?.message ? <Alert tone="success">{actionData.message}</Alert> : null}
      {actionData?.error ? <Alert tone="error">{actionData.error}</Alert> : null}

      <div className="admin-stats">
        <StatCard icon="sparkle" label="Customers ready for a coupon" value={String(eligible.length)} />
        <StatCard icon="gift" label="Available coupons" value={String(report.coupons.available)} />
        <StatCard icon="lock" label="Paused coupons" value={String(report.coupons.disabled)} />
        <StatCard icon="check" label="Redeemed coupons" value={String(report.coupons.redeemed)} />
      </div>

      <div className="admin-grid admin-grid--even">
        <section className="card">
          <div className="card__header"><h2>Reward settings</h2></div>
          <div className="card__body">
            <Form method="post">
              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Coupon every N orders (per customer)</span>
                  <input className="input" name="everyNthOrder" type="number" min="1" max="1000000" defaultValue={config.everyNthOrder} required />
                </label>
                <label className="field">
                  <span className="field__label">Discount percentage</span>
                  <input className="input" name="discountPercent" type="number" min="0" max="100" defaultValue={config.discountPercent} required />
                </label>
              </div>
              <p className="field__hint" style={{ marginBottom: 16 }}>
                Changes apply to coupons generated from now on. Existing coupons keep their percentage unless you edit them below.
              </p>
              <button className="btn btn--primary" name="intent" value="update-config" type="submit" disabled={busyIntent === "update-config"}>
                {busyIntent === "update-config" ? "Saving…" : "Save reward settings"}
              </button>
            </Form>
          </div>
        </section>

        <section className="card">
          <div className="card__header"><h2>Create a custom coupon</h2></div>
          <div className="card__body">
            <Form method="post" key={actionData?.message?.startsWith("Created") ? actionData.message : "create"}>
              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Code (optional)</span>
                  <input className="input" name="code" placeholder="e.g. WELCOME15" maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,31}" />
                </label>
                <label className="field">
                  <span className="field__label">Discount percentage</span>
                  <input className="input" name="percentOff" type="number" min="1" max="100" defaultValue={15} required />
                </label>
              </div>
              <label className="field">
                <span className="field__label">Who can use it</span>
                <CustomerSelect customers={customers} defaultValue={null} />
              </label>
              <p className="field__hint" style={{ marginBottom: 16 }}>Leave the code empty to generate one. Each coupon can be redeemed once.</p>
              <button className="btn btn--accent" name="intent" value="create-coupon" type="submit" disabled={busyIntent === "create-coupon"}>
                <Icon name="plus" size={18} />
                {busyIntent === "create-coupon" ? "Creating…" : "Create coupon"}
              </button>
            </Form>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card__header">
          <h2>Customer rewards</h2>
          <span className="muted small">{eligible.length} ready to generate</span>
        </div>
        {sortedCustomers.length === 0 ? (
          <div className="card__body">
            <EmptyState icon="user" title="No customers yet" message="Customers appear here once they register." />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Customer</th><th className="num">Orders</th><th>Progress to next coupon</th><th className="num">Earned</th><th className="num">Action</th></tr>
              </thead>
              <tbody>
                {sortedCustomers.map((customer) => <CustomerRewardRow key={customer.id} customer={customer} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__header">
          <h2>All coupons</h2>
          <span className="muted small">{coupons.length} total</span>
        </div>
        {sortedCoupons.length === 0 ? (
          <div className="card__body">
            <EmptyState icon="gift" title="No coupons yet" message="Generate a customer's milestone coupon or create a custom one above." />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Code</th><th>Can be used by</th><th>Discount</th><th>Status</th><th className="num">Actions</th></tr>
              </thead>
              <tbody>
                {sortedCoupons.map((coupon) => (
                  <CouponRow key={coupon.code} coupon={coupon} customers={customers} customerNames={customerNames} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function CustomerSelect({
  customers,
  defaultValue,
  form,
  label,
}: {
  customers: CustomerRewardSummary[];
  defaultValue: Uuid | null;
  form?: string;
  label?: string;
}) {
  return (
    <select className="select input--sm" name="customerId" defaultValue={defaultValue ?? ""} form={form} aria-label={label}>
      <option value="">Anyone</option>
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>{customer.name} · {customer.email}</option>
      ))}
    </select>
  );
}

function CustomerRewardRow({ customer }: { customer: CustomerRewardSummary }) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const ready = customer.eligibleMilestone !== null;
  const progress = ready ? 100 : ((customer.everyNthOrder - customer.ordersUntilNextMilestone) / customer.everyNthOrder) * 100;

  return (
    <tr>
      <td>
        <div className="admin-user-cell">
          <span className="avatar">{customer.name.slice(0, 1)}</span>
          <div>
            <strong>{customer.name}</strong>
            <span className="muted small">{customer.email}</span>
          </div>
        </div>
      </td>
      <td className="num">{customer.ordersPlaced}</td>
      <td>
        <div className="milestone milestone--compact">
          <div className="milestone__track"><div className="milestone__fill" style={{ clipPath: `inset(0 ${100 - progress}% 0 0 round 999px)` }} /></div>
          <span className="muted small">
            {ready ? `Reached order #${customer.eligibleMilestone}` : `${customer.ordersUntilNextMilestone} more to order #${customer.nextMilestone}`}
          </span>
        </div>
      </td>
      <td className="num">{customer.couponsEarned}</td>
      <td>
        <fetcher.Form method="post" className="inline-form">
          <input type="hidden" name="customerId" value={customer.id} />
          {ready ? (
            <button className="btn btn--accent btn--sm" name="intent" value="generate" type="submit" disabled={busy}>
              <Icon name="gift" size={16} />
              {busy ? "Generating…" : `Generate ${customer.discountPercent}% coupon`}
            </button>
          ) : (
            <span className="badge badge--neutral">Not yet eligible</span>
          )}
          <RowStatus saving={busy} data={fetcher.data} />
        </fetcher.Form>
      </td>
    </tr>
  );
}

function CouponRow({
  coupon,
  customers,
  customerNames,
}: {
  coupon: Coupon;
  customers: CustomerRewardSummary[];
  customerNames: Map<string, string>;
}) {
  const save = useFetcher<ActionResult>();
  const remove = useFetcher<ActionResult>();
  const formId = `coupon-${coupon.code}`;
  const busy = save.state !== "idle" || remove.state !== "idle";
  const origin = coupon.source === "milestone"
    ? `Earned by ${customerNames.get(coupon.earnedByCustomerId ?? "") ?? "a customer"} · order #${coupon.milestone}`
    : "Custom coupon";

  if (coupon.status === "redeemed") {
    return (
      <tr className="row--locked">
        <td>
          <span className="code-pill">{coupon.code}</span>
          <div className="muted small">{origin}</div>
        </td>
        <td>{coupon.customerId ? customerNames.get(coupon.customerId) ?? "Unknown customer" : "Anyone"}</td>
        <td><strong>{coupon.percentOff}%</strong></td>
        <td><span className="badge badge--neutral">Redeemed</span></td>
        <td className="num">
          <span className="muted small" title="Redeemed coupons are part of an order receipt and cannot change.">
            <Icon name="lock" size={14} /> Order #{coupon.redeemedOrderId?.slice(0, 8).toUpperCase()}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <span className="code-pill">{coupon.code}</span>
        <div className="muted small">{origin}</div>
      </td>
      <td>
        <CustomerSelect customers={customers} defaultValue={coupon.customerId} form={formId} label={`Who can use ${coupon.code}`} />
      </td>
      <td>
        <span className="input-suffix">
          <input
            className="input input--sm"
            name="percentOff"
            type="number"
            min="1"
            max="100"
            defaultValue={coupon.percentOff}
            form={formId}
            aria-label={`Discount for ${coupon.code}`}
            required
          />
          <span>%</span>
        </span>
      </td>
      <td>
        <select className="select input--sm" name="status" defaultValue={coupon.status} form={formId} aria-label={`Status of ${coupon.code}`}>
          <option value="available">Active</option>
          <option value="disabled">Paused</option>
        </select>
      </td>
      <td>
        <div className="inline-form">
          <save.Form method="post" id={formId}>
            <input type="hidden" name="code" value={coupon.code} />
            <button className="btn btn--primary btn--sm" name="intent" value="update-coupon" type="submit" disabled={busy}>
              {save.state !== "idle" ? "Saving…" : "Save"}
            </button>
          </save.Form>
          <remove.Form
            method="post"
            onSubmit={(event) => {
              if (!window.confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)) event.preventDefault();
            }}
          >
            <input type="hidden" name="code" value={coupon.code} />
            <button className="icon-button icon-button--sm icon-button--danger" name="intent" value="delete-coupon" type="submit" disabled={busy} aria-label={`Delete ${coupon.code}`} title="Delete">
              <Icon name="trash" size={14} />
            </button>
          </remove.Form>
          <RowStatus saving={busy} data={remove.data?.error ? remove.data : save.data} />
        </div>
      </td>
    </tr>
  );
}
