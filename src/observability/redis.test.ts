import { createServer, type AddressInfo } from "node:net";
import { expect, it } from "vitest";
import { pingRedis } from "./redis";

function listen() {
  const server = createServer(socket => {
    let buffer = "";
    socket.on("data", chunk => {
      buffer += chunk.toString();
      if (buffer.includes("AUTH")) {
        socket.write("-WRONGPASS\r\n");
        return;
      }
      if (buffer.includes("PING")) socket.write("+PONG\r\n");
    });
  });
  return new Promise<{ server: typeof server; port: number }>(resolve => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as AddressInfo).port }));
  });
}

it("pings redis and hides the password when auth fails", async () => {
  const { server, port } = await listen();
  try {
    await expect(pingRedis(`redis://127.0.0.1:${port}`)).resolves.toBeUndefined();
    const secretUrl = `redis://:${encodeURIComponent("s3cret-pass")}@127.0.0.1:${port}/1`;
    await expect(pingRedis(secretUrl)).rejects.toThrow("redis check failed");
    await expect(pingRedis(secretUrl)).rejects.toThrow(/^((?!s3cret-pass).)*$/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

it.skipIf(!process.env.KSEF_REDIS_TEST_URL)("pings the CI redis", async () => {
  await expect(pingRedis(process.env.KSEF_REDIS_TEST_URL!)).resolves.toBeUndefined();
});
