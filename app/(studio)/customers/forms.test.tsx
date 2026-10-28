/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ImportForm } from "./forms";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

it("uploads the selected CSV or XLSX file as multipart FormData", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ createdClients: 1, createdVehicles: 1, unchanged: 0, invalid: 0, errors: [], warnings: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ImportForm studioId="studio-1" />);

  const file = new File(["workbook"], "klienci.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  await user.upload(screen.getByLabelText("Import CSV lub XLSX"), file);
  await user.click(screen.getByRole("button", { name: "Importuj" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/studios/studio-1/clients/import");
  expect(options.method).toBe("POST");
  expect(options.body).toBeInstanceOf(FormData);
  expect((options.body as FormData).get("file")).toBe(file);
  expect(options.headers).toBeUndefined();
  expect(screen.getByRole("status").textContent).toContain("Nowe osoby: 1");
  expect(refresh).toHaveBeenCalledOnce();
});

it("asks for a file before sending an import request", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<ImportForm studioId="studio-1" />);

  await user.click(screen.getByRole("button", { name: "Importuj" }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toBe("Wybierz plik CSV lub XLSX.");
});
