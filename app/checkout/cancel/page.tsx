import Link from "next/link";

export const metadata = { title: "Checkout cancelled" };

export default function CheckoutCancelPage() {
  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Checkout cancelled</h1>
      <p className="text-muted-foreground text-sm">
        No payment was taken. Your devices are still pending activation — you can start
        checkout again whenever you&apos;re ready.
      </p>
      <Link href="/app/devices" className="text-sm underline">
        Back to your devices
      </Link>
    </main>
  );
}
