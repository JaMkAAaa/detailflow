import { spawn } from "node:child_process";
import path from "node:path";
import { AccessError } from "../server/acl";

/** Validate against the pinned local schema; never fetch schemas or return XML diagnostics. */
export async function validateFa3Xsd(xml: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const fail = () => reject(new AccessError(409, "Nie udało się zweryfikować XML FA(3). Sprawdź dane faktury i konfigurację walidatora."));
    const child = spawn("xmllint", ["--nonet", "--noout", "--schema", path.join(process.cwd(), "src/ksef/xsd/FA_3.xsd"), "-"], { stdio: ["pipe", "ignore", "ignore"] });
    const timer = setTimeout(() => { child.kill(); fail(); }, 10_000);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.on("close", code => { clearTimeout(timer); if (code === 0) resolve(); else fail(); });
    child.stdin.end(xml);
  });
}
