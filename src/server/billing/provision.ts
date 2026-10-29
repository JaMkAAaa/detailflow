import { provisionBilling } from "./provisioning";
import { getStripe } from "./stripe";

provisionBilling(getStripe()).catch(error => {
  console.error(error instanceof Error ? error.message : "Nie udało się skonfigurować Stripe.");
  process.exitCode = 1;
});
