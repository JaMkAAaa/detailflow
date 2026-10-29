// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { PortfolioScreen } from "./PortfolioScreen";
import { PublicPortfolio } from "./PublicPortfolio";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const photo = {
  id: "photo1", no: 1, caption: "prywatny opis", published: false, plateVisible: false, mask: null,
  previewUrl: "https://s3.test/get/studios/a/orders/o/photo1.png?X-Amz-Signature=secret", urlExpiresIn: 300,
  make: "Porsche", model: "911", plate: "WA 911PC", service: "Korekta", clientName: "Adam Nowak", orderNumber: "DF-0248",
};

it("requires an explicit plate choice and sends the mask, not a hidden text field", async () => {
  const user = userEvent.setup();
  const actions = { publish: vi.fn().mockResolvedValue({ ok: true, value: {} }), unpublish: vi.fn() };
  render(<PortfolioScreen studioId="a" publicHref="/realizacje/obsidian-studio" photos={[photo]} truncated={false} canPublish canUnpublish={false} actions={actions} />);
  expect(screen.getByRole("link", { name: "Strona publiczna" }).getAttribute("href")).toBe("/realizacje/obsidian-studio");
  expect(screen.getByText(/nie maskuje tablicy na fotografii/)).toBeTruthy();
  const publish = screen.getByRole("button", { name: "Opublikuj Porsche 911 nr 1" }) as HTMLButtonElement;
  expect(publish.disabled).toBe(true);
  expect((screen.getByRole("checkbox", { name: "Zostaw tablicę widoczną na zdjęciu Porsche 911 nr 1" }) as HTMLInputElement).checked).toBe(false);
  await user.click(screen.getByRole("button", { name: "Dolny środek kadru Porsche 911 nr 1" }));
  await user.click(screen.getByRole("button", { name: "Opublikuj Porsche 911 nr 1" }));
  expect(actions.publish).toHaveBeenCalledWith("a", "photo1", { plateVisible: false, mask: { x: 0.3, y: 0.62, w: 0.4, h: 0.16 } });
  expect(refresh).toHaveBeenCalledOnce();
});

it("sends a conscious unmasked publication and can take a public photo down", async () => {
  const user = userEvent.setup();
  const actions = {
    publish: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    unpublish: vi.fn().mockResolvedValue({ ok: true, value: {} }),
  };
  const { rerender } = render(<PortfolioScreen studioId="a" publicHref="/realizacje/obsidian-studio" photos={[photo]} truncated={false} canPublish canUnpublish actions={actions} />);
  await user.click(screen.getByRole("checkbox", { name: /Zostaw tablicę widoczną/ }));
  await user.click(screen.getByRole("button", { name: "Opublikuj Porsche 911 nr 1" }));
  expect(actions.publish).toHaveBeenCalledWith("a", "photo1", { plateVisible: true });
  rerender(<PortfolioScreen studioId="a" publicHref="/realizacje/obsidian-studio" photos={[{ ...photo, published: true, plateVisible: true }]} truncated={false} canPublish={false} canUnpublish actions={actions} />);
  expect(screen.queryByRole("button", { name: /Opublikuj/ })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Cofnij publikację Porsche 911 nr 1" }));
  expect(actions.unpublish).toHaveBeenCalledWith("a", "photo1");
});

it("shows an empty studio list and keeps publication controls away from read-only roles", () => {
  const actions = { publish: vi.fn(), unpublish: vi.fn() };
  const { rerender } = render(<PortfolioScreen studioId="a" publicHref="/realizacje/x" photos={[]} truncated={false} canPublish={false} canUnpublish={false} actions={actions} />);
  expect(screen.getByRole("status").textContent).toMatch(/Brak potwierdzonych zdjęć/);
  expect(screen.queryByRole("button", { name: /Opublikuj/ })).toBeNull();
  rerender(<PortfolioScreen studioId="a" publicHref="/realizacje/x" photos={[photo]} truncated={false} canPublish={false} canUnpublish={false} actions={actions} />);
  expect(screen.getByText(/właściciel lub manager/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Opublikuj/ })).toBeNull();
});

it("renders a public gallery without client data and an empty state instead of an error", () => {
  const { rerender } = render(<PublicPortfolio studio={{ name: "Obsidian Studio", city: "Warszawa" }} items={[]} />);
  expect(screen.getByRole("status").textContent).toMatch(/nie opublikowało jeszcze realizacji/);
  expect(screen.queryByText("404")).toBeNull();
  rerender(<PublicPortfolio studio={{ name: "Obsidian Studio", city: "Warszawa" }} items={[{ id: "p1", make: "Porsche", model: "911", service: "Korekta", src: "/realizacje/obsidian-studio/media/p1?v=2" }]} />);
  const img = screen.getByRole("img", { name: "Porsche 911, Korekta" });
  expect(img.getAttribute("src")).toBe("/realizacje/obsidian-studio/media/p1?v=2");
  expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(document.body.textContent).not.toMatch(/Adam|WA 911PC|X-Amz|s3\.test/);
});
