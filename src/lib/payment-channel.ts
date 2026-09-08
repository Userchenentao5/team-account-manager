export function formatPaymentChannelLabel(
  name: string,
  bankCardLast4?: string | null,
): string {
  return bankCardLast4 ? `${name}（${bankCardLast4}）` : name;
}
