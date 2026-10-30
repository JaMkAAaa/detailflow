// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { JpkExport } from "./JpkExport";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("submits the selected period with exactly the displayed environment and shows empty-period errors", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Brak wystawionych faktur w wybranym okresie i środowisku KSeF." }) });
  vi.stubGlobal("fetch", fetcher);
  render(<JpkExport studioId="studio-b" env="production" now="2026-10-24T12:00:00Z" />);
  await userEvent.click(screen.getByRole("button", { name: "Eksport JPK" }));
  expect(screen.getByRole("heading").textContent).toContain("PROD");
  const form = screen.getByRole("button", { name: "Pobierz XML" }).closest("form")!;
  fireEvent.submit(form);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Brak wystawionych"));
  const [url, request] = fetcher.mock.calls[0]!;
  expect(url).toBe("/api/studios/studio-b/invoices/jpk");
  expect(JSON.parse(request.body)).toMatchObject({ from: "2026-10-01", to: "2026-10-24", env: "production" });
});
