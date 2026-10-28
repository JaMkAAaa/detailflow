// Te same konta co prisma/seed.ts i prisma/seed-platform.ts. Hasła są tylko demo.
export const studioOwner = {
  email: "michal.kowalski@example.com",
  password: "obsidian-demo-2026",
} as const;

export const platformOperator = {
  email: "anna.nowak@detailflow.test",
  password: "platform-demo-2026",
} as const;

export const portalToken = "obsidian-df-0248-demo";
export const expiredPortalToken = "obsidian-df-0244-expired";
