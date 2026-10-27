export const TEST_API = "https://api-test.ksef.mf.gov.pl/v2";

/** Fail closed, including when Next's general env validation is disabled. */
export function assertKsefTest() {
  if ((process.env.KSEF_ENV ?? "test") !== "test") throw new Error("KSeF: only TEST is supported");
  const url = (process.env.KSEF_API_URL ?? TEST_API).replace(/\/$/, "");
  if (url !== TEST_API && url !== TEST_API.replace(/\/v2$/, "")) throw new Error("KSeF: TEST API URL required");
}
