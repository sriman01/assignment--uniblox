import { getRequestListener } from "@hono/node-server";
import { createServerlessApi } from "./infrastructure/composition/createServerlessApi.js";

/** Vercel function serving `/api/*`, bundled by scripts/build-vercel.mjs. */
const app = await createServerlessApi();

export default getRequestListener(app.fetch);
