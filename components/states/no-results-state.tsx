import { Button, type ButtonProps } from "../ui/button";
import { EmptyState, type EmptyStateProps } from "./empty-state";

type NoResultsStateProps = Omit<EmptyStateProps, "title" | "icon" | "description" | "actions"> & {
  query?: string;
  description?: EmptyStateProps["description"];
  onClearFilters: NonNullable<ButtonProps["onClick"]>;
  actions?: EmptyStateProps["actions"];
};

function NoResultsState({
  query,
  description = "Zmień lub wyczyść filtry i spróbuj ponownie. Sprawdź też pisownię wyszukiwanej frazy.",
  onClearFilters,
  actions,
  ...props
}: NoResultsStateProps) {
  return (
    <EmptyState
      {...props}
      title={query?.trim() ? `Nie znaleziono „${query}”` : "Brak wyników"}
      description={description}
      // Local decorative Figma SVG, preserving its original geometry.
      // eslint-disable-next-line @next/next/no-img-element
      icon={<img src="/states/search.svg" width={28} height={28} alt="" />}
      actions={<><Button variant="secondary" onClick={onClearFilters}>Wyczyść filtry</Button>{actions}</>}
    />
  );
}

export { NoResultsState, type NoResultsStateProps };
