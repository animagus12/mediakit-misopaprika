import { Archivo_Black, Poppins } from "next/font/google";
import { cn } from "@/lib/utils";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-invoice-heading",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-invoice-body",
});

export default function InvoiceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={cn(archivoBlack.variable, poppins.variable)}>{children}</div>
  );
}
