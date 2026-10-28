export class PlatformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformError";
  }
}

export type FormState = { message: string; tone: "idle" | "ok" | "error" };

export const idleForm: FormState = { message: "", tone: "idle" };

export function formFailure(error: unknown): FormState {
  if (error instanceof PlatformError) return { message: error.message, tone: "error" };
  throw error;
}
