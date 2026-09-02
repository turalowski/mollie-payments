/**
 * Base URL of this deployment, used to build Mollie redirect and webhook
 * URLs. Mollie must be able to reach the webhook URL over the public
 * internet — during local development, point this at an ngrok/tunnel URL.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error(
      'Missing required environment variable "NEXT_PUBLIC_APP_URL". See .env.example.'
    );
  }
  return url.replace(/\/+$/, "");
}
