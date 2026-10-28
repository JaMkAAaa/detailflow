export const TEST_API = "https://api-test.ksef.mf.gov.pl/v2";
export const PROD_API = "https://api.ksef.mf.gov.pl/v2";

export type KsefEnvironment = "test" | "production";

function hosts(api: string) {
  const url = api.replace(/\/$/, "");
  return [url, url.replace(/\/v2$/, "")];
}

/** Fail closed, including when Next's general env validation is disabled. */
export function assertKsefTest() {
  if ((process.env.KSEF_ENV ?? "test") !== "test") throw new Error("KSeF: only TEST is supported");
  const url = (process.env.KSEF_API_URL ?? TEST_API).replace(/\/$/, "");
  if (!hosts(TEST_API).includes(url)) throw new Error("KSeF: TEST API URL required");
}

/** Official production host only. A TEST URL is rejected before any request. */
export function assertKsefProduction() {
  const url = (process.env.KSEF_PROD_API_URL ?? PROD_API).replace(/\/$/, "");
  if (!hosts(PROD_API).includes(url)) throw new Error("KSeF: PROD API URL required");
}

export function ksefApiUrl(env: KsefEnvironment) {
  if (env === "test") {
    assertKsefTest();
    return TEST_API;
  }
  assertKsefProduction();
  return PROD_API;
}
