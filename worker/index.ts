// Szkielet workera BullMQ. Kolejki (KSeF, e-mail, Stripe) dochodzą w osobnych issue.
console.log("[worker] started");

const keepAlive = setInterval(() => {}, 1 << 30);

function shutdown(signal: string) {
  console.log(`[worker] ${signal}, stopping`);
  clearInterval(keepAlive);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
