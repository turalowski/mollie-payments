import "server-only";

import createMollieClient, { type MollieClient } from "@mollie/api-client";

let client: MollieClient | undefined;

/**
 * Lazily-created singleton Mollie API client. `server-only` guards
 * against this (and the API key) ever ending up in a client bundle.
 */
export function getMollieClient(): MollieClient {
  if (!client) {
    const apiKey = process.env.MOLLIE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing required environment variable "MOLLIE_API_KEY". See .env.example.'
      );
    }
    client = createMollieClient({ apiKey });
  }
  return client;
}
