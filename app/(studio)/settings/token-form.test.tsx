// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TokenForm } from "./token-form";

const studioId = "stu_settings";
const token = "fixture-ksef-token-124";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("sends the token only to the existing PUT route and never renders it", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const { container } = render(<TokenForm studioId={studioId} tokenSet={false} />);
  expect(container.innerHTML).not.toContain(token);
  expect(screen.getByText("Brak zapisanego tokenu.")).toBeTruthy();
  await user.type(screen.getByLabelText("Token"), token);
  await user.click(screen.getByRole("button", { name: "Zapisz token" }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe(`/api/studios/${studioId}/ksef/token`);
  expect(url).not.toContain(token);
  expect(init.method).toBe("PUT");
  expect(init.body).toBe(JSON.stringify({ token }));
  expect(screen.getByRole("status").textContent).toBe("Token KSeF został zapisany.");
  expect(screen.getByLabelText("Token").getAttribute("type")).toBe("password");
  expect((screen.getByLabelText("Token") as HTMLInputElement).value).toBe("");
  expect(document.body.textContent).not.toContain(token);
});
