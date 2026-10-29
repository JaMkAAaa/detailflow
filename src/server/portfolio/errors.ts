import { ZodError } from "zod";
import { apiError } from "../http";

export class PortfolioError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) { super(message); }
}

export function portfolioErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  if (error instanceof PortfolioError) return Response.json({ error: error.message }, { status: error.status });
  return apiError(error);
}
