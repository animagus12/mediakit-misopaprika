import { Suspense } from "react";
import type { Metadata } from "next";
import { InvoiceLoginForm } from "@/components/invoice/InvoiceLoginForm";

export const metadata: Metadata = {
  title: "Sign in - @misopaprika",
  robots: { index: false, follow: false },
};

export default function InvoiceLoginPage() {
  return (
    <Suspense>
      <InvoiceLoginForm />
    </Suspense>
  );
}
