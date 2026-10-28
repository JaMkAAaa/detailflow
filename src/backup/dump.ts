import { spawn } from "node:child_process";

export function pgDumpArgs(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database || (url.protocol !== "postgresql:" && url.protocol !== "postgres:")) {
    throw new Error("DATABASE_URL is invalid");
  }
  const args = [
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--host", url.hostname,
    "--port", url.port || "5432",
    "--username", decodeURIComponent(url.username),
    "--dbname", database,
  ];
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  return { args, env };
}

export function dumpDatabase(databaseUrl: string) {
  const spec = pgDumpArgs(databaseUrl);
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn("pg_dump", spec.args, { env: spec.env, stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", () => undefined);
    child.on("error", () => reject(new Error("pg_dump failed")));
    child.on("close", code => {
      if (code !== 0) reject(new Error("pg_dump failed"));
      else resolve(Buffer.concat(chunks));
    });
  });
}
