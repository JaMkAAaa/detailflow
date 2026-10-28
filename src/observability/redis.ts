import { connect as connectTcp } from "node:net";
import { connect as connectTls } from "node:tls";

function command(args: string[]) {
  return `*${args.length}\r\n${args.map(arg => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("")}`;
}

export function pingRedis(url: string, timeoutMs = 1_500) {
  return new Promise<void>((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error("redis check failed"));
      return;
    }
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
      reject(new Error("redis check failed"));
      return;
    }
    const socket = parsed.protocol === "rediss:"
      ? connectTls({ host: parsed.hostname, port: Number(parsed.port || 6379), servername: parsed.hostname })
      : connectTcp({ host: parsed.hostname, port: Number(parsed.port || 6379) });
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (ok) resolve();
      else reject(new Error("redis check failed"));
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    let buffer = "";
    const expected: string[] = [];
    if (parsed.password) expected.push("auth");
    if (parsed.pathname.length > 1) expected.push("select");
    expected.push("ping");
    socket.on("error", () => finish(false));
    socket.on("data", chunk => {
      buffer += chunk.toString();
      while (buffer.includes("\r\n") && expected.length) {
        const line = buffer.slice(0, buffer.indexOf("\r\n"));
        buffer = buffer.slice(buffer.indexOf("\r\n") + 2);
        if (line.startsWith("-")) {
          finish(false);
          return;
        }
        const step = expected[0];
        const success = line === "+OK" || line === "+PONG" || (line === "$4" && buffer.startsWith("PONG"));
        if (!success) continue;
        if (line === "$4") buffer = buffer.slice(buffer.indexOf("\r\n") + 2);
        expected.shift();
        if (expected.length === 0 && step === "ping") finish(true);
      }
    });
    socket.on("connect", () => {
      const parts: string[] = [];
      if (parsed.password) parts.push(command(["AUTH", decodeURIComponent(parsed.password)]));
      if (parsed.pathname.length > 1) parts.push(command(["SELECT", parsed.pathname.slice(1)]));
      parts.push(command(["PING"]));
      socket.write(parts.join(""));
    });
  });
}
