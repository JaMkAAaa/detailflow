-- Katalog usług: flaga widoczności. Istniejące wiersze zostają aktywne.
-- QuoteItem.serviceId nie ma klucza obcego, więc usunięcie usługi nie rusza snapshotów.
ALTER TABLE "Service" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
