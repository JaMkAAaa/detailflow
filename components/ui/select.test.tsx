// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { Select } from "./select";

afterEach(cleanup);

const paints = [
  { value: "standard", label: "Standardowy" },
  { value: "worn", label: "Wymaga korekty" },
  { value: "heavy", label: "Mocno zniszczony" },
];

it("opens a list, selects with the pointer and keeps the value on the trigger", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Select aria-label="Stan lakieru" value="standard" onChange={onChange} options={paints} />);
  const trigger = screen.getByRole("combobox", { name: "Stan lakieru" });
  expect(trigger.getAttribute("data-value")).toBe("standard");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await user.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  const selected = screen.getByRole("option", { name: "Standardowy" });
  expect(selected.getAttribute("aria-selected")).toBe("true");
  await user.click(screen.getByRole("option", { name: "Wymaga korekty" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ target: { value: "worn" } });
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("moves the highlight with the arrows and confirms with Enter", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Select aria-label="Stan lakieru" value="standard" onChange={onChange} options={paints} />);
  await user.click(screen.getByRole("combobox", { name: "Stan lakieru" }));
  await user.keyboard("{ArrowDown}{Enter}");
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ target: { value: "worn" } });
});

it("closes on Escape without changing the value and ignores a disabled trigger", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { rerender } = render(<Select aria-label="Stan lakieru" value="standard" onChange={onChange} options={paints} />);
  await user.click(screen.getByRole("combobox", { name: "Stan lakieru" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  rerender(<Select aria-label="Stan lakieru" value="standard" disabled onChange={onChange} options={paints} />);
  await user.click(screen.getByRole("combobox", { name: "Stan lakieru" }));
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("submits the chosen value from an uncontrolled field", async () => {
  const user = userEvent.setup();
  let saved = "";
  render(
    <form onSubmit={(event) => { event.preventDefault(); saved = String(new FormData(event.currentTarget).get("role")); }}>
      <Select name="role" aria-label="Rola" defaultValue="worker" options={[{ value: "worker", label: "Pracownik" }, { value: "manager", label: "Manager" }]} />
      <button type="submit">Zapisz</button>
    </form>,
  );
  await user.click(screen.getByRole("combobox", { name: "Rola" }));
  await user.click(screen.getByRole("option", { name: "Manager" }));
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(saved).toBe("manager");
});

it("shows a muted placeholder until a value is chosen and lists a studio with its city", async () => {
  const user = userEvent.setup();
  render(
    <>
      <Select aria-label="Klient" value="" placeholder="Wybierz klienta" options={[{ value: "anna", label: "Anna" }]} />
      <Select aria-label="Studio" size="studio" value="obsidian" options={[{ value: "obsidian", label: "Obsidian Studio", description: "Warszawa, Mokotów" }]} />
    </>,
  );
  expect(screen.getByText("Wybierz klienta").className).toContain("text-df-muted");
  expect(screen.getByRole("combobox", { name: "Studio" }).textContent).toContain("Warszawa, Mokotów");
  await user.click(screen.getByRole("combobox", { name: "Studio" }));
  expect(screen.getByRole("option", { name: "Obsidian Studio" }).textContent).toContain("Mokotów");
});
