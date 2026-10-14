import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SCRIPT_TEMA_INICIAL } from "@/lib/tema";
import "./globals.css";

// Design system real do Footlink (design_system.html) roda em Barlow.
const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Footlink — Fechamento de Venda",
  description: "Sistema interno de pedidos, aprovação e contratos Footlink",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: data-theme é aplicado no <html> pelo script
    // antes da hidratação, então diverge do HTML do servidor de propósito.
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning className={`${barlow.variable} h-full antialiased`}>
      <head>
        {/* Inline e síncrono no <head> (root layout é Server Component, então
            sai direto no HTML): aplica o tema salvo antes da primeira pintura.
            next/script beforeInteractive com código inline só enfileira em
            self.__next_s pro runtime do Next executar depois — daria flash. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
