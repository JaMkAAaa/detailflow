export function formatPln(decimal: string) {
  const [whole = "0", fraction = "00"] = decimal.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${fraction === "00" ? "" : `,${fraction}`} zł`;
}
