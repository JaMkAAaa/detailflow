// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { OrderDetails } from "./OrderDetails";
import { order } from "./demo";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const signed = "https://s3.test/get/studios/studio-test/orders/demo-order/abc.jpg?X-Amz-Signature=getsig";
const listed = {
  id: "abc", no: 13, stage: 2, caption: "rysa", contentType: "image/jpeg", sizeBytes: 8,
  createdAt: "2026-10-24T09:20:00.000Z", uploadedAt: "2026-10-24T09:20:00.000Z", url: signed, urlExpiresIn: 300,
};
const key = "studios/studio-test/orders/demo-order/abc.jpg";
const blank = { ...order, photos: [] };

function stubPhotos(confirmStatus: number, confirmBody: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let confirmed = false;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/photos") && init?.method === "POST") {
      return json({
        id: "abc", no: 13, stage: 2, key,
        uploadUrl: "https://s3.test/put/studios/studio-test/orders/demo-order/abc.jpg?X-Amz-Signature=putsig",
        headers: { "Content-Type": "image/jpeg" },
      }, 201);
    }
    if (url.includes("X-Amz-Signature=putsig")) return new Response(null, { status: 200 });
    if (url.endsWith("/photos/confirm")) {
      confirmed = confirmStatus < 300;
      return json(confirmBody, confirmStatus);
    }
    if (url.endsWith("/photos")) return json(confirmed ? [listed] : []);
    return json({ error: "nieoczekiwane" }, 500);
  });
  vi.stubGlobal("fetch", fetcher);
  return calls;
}

async function upload() {
  const user = userEvent.setup();
  const file = new File([new Uint8Array(8)], "rysa.jpg", { type: "image/jpeg" });
  render(<OrderDetails data={blank} studioId="studio-test" initialTab="zdjecia" />);
  await user.upload(screen.getByLabelText("Dodaj zdjęcia"), file);
  return file;
}

it("uploads with a presigned PUT and shows the signed photo", async () => {
  const calls = stubPhotos(200, listed);
  const file = await upload();
  const image = await screen.findByRole("img", { name: "Porsche Panamera — rysa" });
  expect(image.getAttribute("src")).toBe(signed);
  const post = calls.find((call) => call.url.endsWith("/photos") && call.init?.method === "POST");
  expect(JSON.parse(String(post?.init?.body))).toEqual({ contentType: "image/jpeg", sizeBytes: 8, stage: 2, caption: "rysa" });
  const put = calls.find((call) => call.url.includes("X-Amz-Signature=putsig"));
  expect(put?.init?.method).toBe("PUT");
  expect((put?.init?.headers as { "Content-Type": string })["Content-Type"]).toBe("image/jpeg");
  expect(put?.init?.body).toBe(file);
  expect(JSON.parse(String(calls.find((call) => call.url.endsWith("/photos/confirm"))?.init?.body))).toEqual({ key });
  expect(calls.some((call) => call.url.includes("cdn.example"))).toBe(false);
});

it("shows a confirm 400 on the photo tile", async () => {
  stubPhotos(400, { error: "Wgrany plik nie zgadza się z zapowiedzianym rozmiarem lub typem." });
  await upload();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Wgrany plik nie zgadza się z zapowiedzianym rozmiarem lub typem.");
  expect(alert.closest("li")).toBeTruthy();
  expect(screen.queryByRole("img", { name: /rysa/ })).toBeNull();
  expect(document.body.innerHTML).not.toContain("https://s3.test/get/");
});

it("does not confirm a key outside the studio prefix", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/photos") && init?.method === "POST") {
      return json({ key: "other/studio/file.jpg", uploadUrl: "https://s3.test/put/file.jpg?X-Amz-Signature=putsig", headers: { "Content-Type": "image/jpeg" } }, 201);
    }
    if (url.endsWith("/photos")) return json([]);
    return json({ error: "nieoczekiwane" }, 500);
  }));
  await upload();
  expect((await screen.findByRole("alert")).textContent).toContain("Brak dostępu.");
  expect(calls.some((call) => call.url.endsWith("/photos/confirm") || call.url.includes("X-Amz-Signature=putsig"))).toBe(false);
});

it("drops a photo list URL that has no signature", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => json([{ ...listed, url: "https://cdn.example/bucket/photo.jpg" }])));
  render(<OrderDetails data={{ ...blank, photos: [{ no: 1, at: order.photos[0]!.at, caption: "publiczne", stage: "Przyjęcie i mycie", src: "https://cdn.example/public.jpg" }] }} studioId="studio-test" initialTab="zdjecia" />);
  expect(screen.queryByRole("img", { name: /publiczne/ })).toBeNull();
  expect(await screen.findByText("Brak zdjęć. Dodaj pierwsze zdjęcie przy przyjęciu auta.")).toBeTruthy();
  expect(document.body.innerHTML).not.toContain("cdn.example");
});

const editable = {
  ...blank,
  intake: {
    ...order.intake,
    acceptedAt: "",
    damages: [{ no: 1, title: "Rysa", part: "Błotnik", size: "4 cm", x: 0.2, y: 0.3 }],
  },
};

function protocolResponse(acceptedAt: string | null) {
  return {
    number: "P-0248",
    createdAt: "2026-10-24T06:00:00.000Z",
    acceptedAt,
    createdBy: { id: "u", name: "Michał Kowalski" },
    damages: [{ no: 1, title: "Rysa", part: "Błotnik", size: "4 cm", x: 0.2, y: 0.3, photo: null }],
  };
}

it("saves protocol points and locks the form after acceptance", async () => {
  const user = userEvent.setup();
  const calls: { url: string; body?: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/photos")) return json([]);
    if (url.endsWith("/protocol") && init?.method === "PUT") {
      calls.push({ url, body: String(init.body) });
      return json(protocolResponse(null));
    }
    if (url.endsWith("/protocol/accept")) {
      calls.push({ url });
      return json(protocolResponse("2026-10-24T06:04:00.000Z"));
    }
    return json({ error: "nieoczekiwane" }, 500);
  }));
  render(<OrderDetails data={editable} studioId="studio-test" initialTab="stan-auta" />);
  await user.click(screen.getByRole("button", { name: "Zapisz protokół" }));
  await vi.waitFor(() => expect(calls[0]?.body).toBeTruthy());
  expect(JSON.parse(calls[0]!.body!).damages[0]).toMatchObject({ title: "Rysa", part: "Błotnik", x: 0.2, y: 0.3 });
  const accept = await screen.findByRole("button", { name: "Zaakceptuj stan" });
  expect(accept.hasAttribute("disabled")).toBe(false);
  await user.click(accept);
  expect(await screen.findByRole("table", { name: /Uszkodzenia zapisane w protokole #P-0248/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Zapisz protokół" })).toBeNull();
  expect(calls.some((call) => call.url.endsWith("/protocol/accept"))).toBe(true);
});

it("makes the protocol readonly when save returns 409", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/photos")) return json([]);
    if (url.endsWith("/protocol") && init?.method === "PUT") {
      return json({ error: "Protokół jest zaakceptowany przez klienta i nie można go zmienić." }, 409);
    }
    return json({ error: "nieoczekiwane" }, 500);
  }));
  render(<OrderDetails data={editable} studioId="studio-test" initialTab="stan-auta" />);
  await user.click(screen.getByRole("button", { name: "Zapisz protokół" }));
  expect((await screen.findByRole("alert")).textContent).toContain("nie można go zmienić");
  expect(screen.queryByRole("button", { name: "Zapisz protokół" })).toBeNull();
  expect(screen.getByRole("table", { name: /Uszkodzenia zapisane w protokole #P-0248/ })).toBeTruthy();
});
