import { requireSession } from "@/lib/auth/session";
import { readOwnAccount } from "@/src/server/account/query";
import { AccountScreen } from "@/components/auth/account-screen";

export default async function AccountPage() {
  const { user, session } = await requireSession();
  return <AccountScreen account={await readOwnAccount(user.id, session.id)} />;
}
