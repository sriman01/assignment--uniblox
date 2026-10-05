import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

/** The API under `/api`, with JSON 404s for unknown API routes. */
export function createApiApp(api: Hono): Hono {
  const app = new Hono();
  app.route("/api", api);
  app.all("/api/*", (c) =>
    c.json({ error: { code: "NOT_FOUND", message: `No route for ${c.req.method} ${c.req.path}.` } }, 404),
  );
  return app;
}

/** The API plus the built React app, for a single long-running Node server. */
export function createServerApp(api: Hono, frontendRoot = "./frontend/dist"): Hono {
  const app = createApiApp(api);
  app.use("/*", serveStatic({ root: frontendRoot }));
  app.get("*", serveStatic({ path: `${frontendRoot}/index.html` }));
  return app;
}
