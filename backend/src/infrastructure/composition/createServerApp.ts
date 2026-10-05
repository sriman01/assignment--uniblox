import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

export function createServerApp(api: Hono, frontendRoot = "./frontend/dist"): Hono {
  const app = new Hono();

  app.route("/api", api);
  app.all("/api/*", (c) =>
    c.json({ error: { code: "NOT_FOUND", message: `No route for ${c.req.method} ${c.req.path}.` } }, 404),
  );

  app.use("/*", serveStatic({ root: frontendRoot }));
  app.get("*", serveStatic({ path: `${frontendRoot}/index.html` }));

  return app;
}
