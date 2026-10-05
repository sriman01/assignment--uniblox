import { createServerlessApi } from "./infrastructure/composition/createServerlessApi.js";

/**
 * Netlify function serving `/api/*`, bundled by scripts/build-netlify.mjs.
 * netlify.toml rewrites `/api/*` to `/.netlify/functions/api/*`; map that back onto the `/api` routes.
 */
const app = await createServerlessApi();
const functionPrefix = "/.netlify/functions/api";

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(functionPrefix)) return app.fetch(request);

  url.pathname = `/api${url.pathname.slice(functionPrefix.length)}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return app.fetch(
    new Request(url, {
      method: request.method,
      headers: request.headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
    }),
  );
}
