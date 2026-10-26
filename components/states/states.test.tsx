// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { NetworkError, NoResultsState } from "./index";

afterEach(cleanup);

it("clears filters from the keyboard without submitting the surrounding form", async () => {
  const submit = vi.fn((event) => event.preventDefault());
  function FilteredList() {
    const [filtered, setFiltered] = useState(true);
    return <form onSubmit={submit}>{filtered
      ? <NoResultsState query="WX 12345" onClearFilters={() => setFiltered(false)} />
      : <p>Lista klientów</p>}</form>;
  }
  const user = userEvent.setup();
  render(<FilteredList />);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Wyczyść filtry" }));
  await user.keyboard("{Enter}");
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("Lista klientów")).toBeTruthy();
  expect(submit).not.toHaveBeenCalled();
});

it("prevents repeated retries while pending and allows retry after failure", async () => {
  const retry = vi.fn();
  function FailedList({ pending = false }: { pending?: boolean }) {
    const [retrying, setRetrying] = useState(pending);
    return <NetworkError retrying={retrying} onRetry={() => { retry(); setRetrying(true); }} />;
  }
  const user = userEvent.setup();
  const { rerender } = render(<FailedList />);
  expect(screen.getByRole("alert").textContent).toContain("Brak połączenia z serwerem");
  await user.dblClick(screen.getByRole("button", { name: "Spróbuj ponownie" }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  rerender(<FailedList key="failed-again" />);
  await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
  expect(retry).toHaveBeenCalledTimes(2);
});
