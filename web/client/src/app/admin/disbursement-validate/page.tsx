import { Suspense } from "react";

import DisbursementValidateClient from "./validate-client";

export default function DisbursementValidatePage() {
  return (
    <Suspense
      fallback={
        <p className="p-10 text-center text-sm text-muted-foreground">
          Loading claim validation…
        </p>
      }
    >
      <DisbursementValidateClient />
    </Suspense>
  );
}
