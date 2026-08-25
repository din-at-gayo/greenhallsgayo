// Stand-in for a real email provider. Logs what would be sent so the booking
// flow is fully functional without requiring email credentials to be
// configured for this internal tool.
export function notify(
  event: string,
  to: string,
  details: Record<string, unknown>,
) {
  console.log(`[notification] ${event} -> ${to}`, details)
}
