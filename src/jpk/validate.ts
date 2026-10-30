import { spawn } from "node:child_process";
import path from "node:path";
import { AccessError } from "../server/access-error";

/** Validate against the pinned local schema; never fetch schemas or return XML diagnostics. */
export async function validateJpkXsd(xml: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const fail = () => reject(new AccessError(409, "Nie udało się zweryfikować XML JPK_FA(4). Sprawdź kod urzędu, dane adresowe, faktury i konfigurację walidatora."));
    const child = spawn("xmllint", ["--nonet", "--noout", "--schema", path.join(process.cwd(), "src/jpk/xsd/JPK_FA_4.xsd"), "-"], { stdio: ["pipe", "ignore", "ignore"] });
    const timer = setTimeout(() => { child.kill(); fail(); }, 10_000);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.on("close", code => { clearTimeout(timer); if (code === 0) resolve(); else fail(); });
    child.stdin.end(xml);
  });
}
