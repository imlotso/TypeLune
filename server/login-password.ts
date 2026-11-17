import argon2 from 'argon2';

// A hash of discarded random bytes, using the same parameters as account passwords.
// Unknown/disabled accounts still perform password verification to reduce timing disclosure.
const unavailableAccountHash = '$argon2id$v=19$m=65536,t=3,p=4$N+s7Jm0Lagmp4cwG9+c6GA$FbJtIu2NMEWuyEOzzRyH9aqpJnclcHqml3tzqcX9R/A';

export async function verifyLoginPassword(storedHash: string | undefined, password: string): Promise<boolean> {
  const verified = await argon2.verify(storedHash ?? unavailableAccountHash, password);
  return storedHash !== undefined && verified;
}
