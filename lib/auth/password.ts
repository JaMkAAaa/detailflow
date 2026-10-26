import { hash, verify } from "@node-rs/argon2";

// Argon2id, parametry minimalne wg OWASP (19 MiB, t=2, p=1). Wynik w formacie PHC,
// więc zmiana parametrów później nie unieważnia starych haseł.
const OPTIONS = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword({ hash: stored, password }: { hash: string; password: string }): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    // Uszkodzony albo obcy format hasha = złe hasło, nie 500.
    return false;
  }
}
