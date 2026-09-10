import Link from "next/link";

export const metadata = { title: "Payment received" };

export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;

  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Payment received</h1>
      <p className="text-muted-foreground text-sm">
        Thanks — your activation is being processed. Your devices will show as
        <span className="font-medium"> captured</span> once Stripe confirms the payment
        (usually within a few seconds).
      </p>
      {sessionId ? (
        <p className="text-muted-foreground font-mono text-xs break-all">{sessionId}</p>
      ) : null}
      <Link href="/app/devices" className="text-sm underline">
        Go to your devices
      </Link>
    </main>
  );
}
