// @vitest-environment jsdom
import { createRef, useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Input } from "./input";

afterEach(cleanup);

describe("Button — native form behavior", () => {
  it.each(["primary", "secondary"] as const)("blocks repeated click and keyboard submits while %s is loading", async (variant) => {
    const submit = vi.fn();
    function Form() {
      const [loading, setLoading] = useState(false);
      return (
        <form onSubmit={(event) => {
          event.preventDefault();
          submit();
          setLoading(true);
        }}>
          <Input aria-label="Nazwa" />
          <Button type="submit" variant={variant} loading={loading}>Zapisz</Button>
        </form>
      );
    }
    const user = userEvent.setup();
    render(<Form />);
    const button = screen.getByRole("button", { name: "Zapisz" });
    await user.dblClick(button);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    await user.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("defaults to a non-submit action and skips disabled/loading controls when tabbing", async () => {
    const submit = vi.fn((event) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={submit}>
        <Button>Akcja</Button>
        <Button disabled>Niedostępne</Button>
        <Button loading>Trwa</Button>
        <Input aria-label="Nazwa" />
      </form>,
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Akcja" }));
    await user.keyboard("{Enter}");
    expect(submit).not.toHaveBeenCalled();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
  });

  it("resumes the action after loading ends and keeps an explicit disabled state", async () => {
    const click = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Button loading onClick={click}>Zapisz</Button>);
    await user.click(screen.getByRole("button"));
    expect(click).not.toHaveBeenCalled();
    rerender(<Button onClick={click}>Zapisz</Button>);
    await user.click(screen.getByRole("button"));
    expect(click).toHaveBeenCalledTimes(1);
    rerender(<Button disabled onClick={click}>Zapisz</Button>);
    await user.click(screen.getByRole("button"));
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe("Input — native semantics", () => {
  it("forwards refs, labels, validation descriptions and form values", async () => {
    const ref = createRef<HTMLInputElement>();
    const user = userEvent.setup();
    render(
      <form aria-label="Klient">
        <label htmlFor="email">E-mail</label>
        <Input ref={ref} id="email" name="email" type="email" required aria-invalid aria-describedby="email-error" />
        <p id="email-error">Podaj poprawny adres.</p>
      </form>,
    );
    const input = screen.getByLabelText("E-mail");
    expect(ref.current).toBe(input);
    expect(input.getAttribute("aria-describedby")).toBe("email-error");
    await user.type(input, "adam@example.com");
    expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("email")).toBe("adam@example.com");
  });
});
