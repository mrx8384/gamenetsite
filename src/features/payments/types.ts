/** Contract every payment gateway implements. Amounts are Rials. */
export interface PaymentProvider {
  key: string;
  label: string;
  /** Test credentials: payments complete but no money moves (only admins may place orders). */
  testMode?: boolean;
  /** Registers the payment with the gateway and returns where to send the customer. */
  createPayment(input: { paymentId: string; amount: bigint; description: string; callbackUrl: string; mobile?: string | null }): Promise<{ authority: string; redirectUrl: string }>;
  /** Called on the callback: confirms with the gateway that the money was received. */
  verifyPayment(input: { authority: string; amount: bigint; callbackParams: URLSearchParams }): Promise<
    { ok: true; referenceId: string; cardPanMasked?: string; raw?: unknown } | { ok: false; reason: string; raw?: unknown }
  >;
}
