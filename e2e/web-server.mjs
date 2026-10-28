import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.env.STRIPE_API_PORT ?? "12119");
const subscriptions = new Map();
const invoices = new Map();

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(body === undefined ? "" : JSON.stringify(body));
}

const fixture = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  try {
    if (request.method === "POST" && url.pathname === "/_register") {
      const body = await readJson(request);
      subscriptions.set(body.subscription.id, body.subscription);
      invoices.set(body.invoice.id, body.invoice);
      response.writeHead(204).end();
      return;
    }
    const subscriptionId = url.pathname.match(/^\/v1\/subscriptions\/([^/]+)$/)?.[1];
    const invoiceId = url.pathname.match(/^\/v1\/invoices\/([^/]+)$/)?.[1];
    const record = subscriptionId
      ? subscriptions.get(decodeURIComponent(subscriptionId))
      : invoiceId
        ? invoices.get(decodeURIComponent(invoiceId))
        : undefined;
    if (request.method !== "GET" || !record) {
      send(response, 404, { error: { type: "invalid_request_error", message: "Brak fixture Stripe." } });
      return;
    }
    send(response, 200, record);
  } catch {
    send(response, 400, { error: { type: "invalid_request_error", message: "Zły fixture Stripe." } });
  }
});

let next;
function stop(code = 0) {
  if (next && !next.killed) next.kill("SIGTERM");
  fixture.close();
  process.exit(code);
}

fixture.on("error", (error) => {
  console.error(error);
  stop(1);
});

fixture.listen(port, "127.0.0.1", () => {
  if (!existsSync(".next/standalone/server.js")) {
    console.error("Brak buildu standalone. Uruchom pnpm build przed testami E2E.");
    stop(1);
  }
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  if (existsSync("public")) cpSync("public", ".next/standalone/public", { recursive: true });
  next = spawn(process.execPath, [".next/standalone/server.js"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "3100", HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
  });
  next.on("exit", (code) => {
    fixture.close();
    process.exit(code ?? 0);
  });
});

process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
