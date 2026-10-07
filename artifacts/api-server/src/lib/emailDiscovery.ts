type EmailAccount = { id: string; emailAddresses: Array<{ emailAddress: string; verification?: { status: string } | null }> };

/** Returns identities only after an exact match to a verified login address. */
export function verifiedEmailUserIds(accounts: EmailAccount[], address: string): string[] {
  const query = address.trim().toLowerCase();
  return accounts.filter(account => account.emailAddresses.some(email =>
    email.emailAddress.toLowerCase() === query && email.verification?.status === "verified"
  )).map(account => account.id);
}
