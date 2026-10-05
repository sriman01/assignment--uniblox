import { serve } from "@hono/node-server";
import { createCheckoutModule } from "./infrastructure/composition/createCheckoutModule.js";

const port = Number(process.env.PORT ?? 4000);
const { app } = createCheckoutModule();

serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, () => {
  console.log(`checkout api listening on http://127.0.0.1:${port}`);
});
