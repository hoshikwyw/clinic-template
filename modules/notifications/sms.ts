/**
 * SMS adapter — provider-agnostic, mirroring ./email.
 *
 * Why this exists: `patients.phone` is required and `patients.email` is not, yet
 * every notification went out by email. In the markets this template targets
 * that means most reminders were never delivered — and reminders are the one
 * feature with a measurable return for a clinic (fewer no-shows). SMS reaches
 * the contact detail we actually hold for everyone.
 *
 * Vendor-wrapping: swapping gateways = a new SmsProvider, nothing else.
 * See docs/01-tech-stack.md ("vendor-wrapping principle").
 */

export interface SmsMessage {
  /** E.164, e.g. "+959771234567" */
  to: string;
  text: string;
}

export interface SmsProvider {
  send(msg: SmsMessage): Promise<void>;
}

/** Default when nothing is configured: log, don't send. */
class ConsoleSmsProvider implements SmsProvider {
  async send(msg: SmsMessage): Promise<void> {
    console.log(
      `[sms:noop] to=${msg.to} text="${msg.text}" (set SMS_PROVIDER to actually send)`
    );
  }
}

/**
 * Twilio. Uses the REST API over `fetch` rather than the SDK — one HTTP call
 * does not justify a dependency, and it keeps the serverless bundle small.
 */
class TwilioSmsProvider implements SmsProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
    /** either a purchased number or a messaging service sid */
    private from: string
  ) {}

  async send(msg: SmsMessage): Promise<void> {
    const body = new URLSearchParams({ To: msg.to, Body: msg.text });
    // A messaging service sid is passed under a different key than a number.
    if (this.from.startsWith("MG")) body.set("MessagingServiceSid", this.from);
    else body.set("From", this.from);

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.accountSid}:${this.authToken}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );

    if (!res.ok) {
      // Twilio returns a JSON error body; include it, but never the credentials.
      const detail = await res.text().catch(() => "");
      throw new Error(`Twilio send failed (${res.status}): ${detail.slice(0, 300)}`);
    }
  }
}

/**
 * Generic HTTP gateway: POSTs `{ to, text }` as JSON to a URL you configure.
 *
 * This is the important one for local carriers. Most regional SMS gateways
 * expose a simple HTTP endpoint and will never have a first-class adapter here,
 * so this lets a clinic plug one in with two environment variables instead of a
 * code change — which is the whole point of a configuration-driven product.
 */
class WebhookSmsProvider implements SmsProvider {
  constructor(
    private url: string,
    private token?: string
  ) {}

  async send(msg: SmsMessage): Promise<void> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({ to: msg.to, text: msg.text }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `SMS webhook failed (${res.status}): ${detail.slice(0, 300)}`
      );
    }
  }
}

/**
 * Select the gateway from the environment.
 *
 * Misconfiguration falls back to the console no-op with a warning rather than
 * throwing: a half-configured gateway must not take booking down, and the
 * notify helpers already swallow send failures for the same reason.
 */
export function getSmsProvider(): SmsProvider {
  const kind = process.env.SMS_PROVIDER?.trim().toLowerCase();

  if (kind === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (sid && token && from) return new TwilioSmsProvider(sid, token, from);
    console.warn(
      "[sms] SMS_PROVIDER=twilio but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM are incomplete — falling back to no-op."
    );
    return new ConsoleSmsProvider();
  }

  if (kind === "webhook") {
    const url = process.env.SMS_WEBHOOK_URL;
    if (url) {
      return new WebhookSmsProvider(url, process.env.SMS_WEBHOOK_TOKEN);
    }
    console.warn(
      "[sms] SMS_PROVIDER=webhook but SMS_WEBHOOK_URL is unset — falling back to no-op."
    );
    return new ConsoleSmsProvider();
  }

  if (kind) {
    console.warn(
      `[sms] Unknown SMS_PROVIDER "${kind}" — expected "twilio" or "webhook". Falling back to no-op.`
    );
  }
  return new ConsoleSmsProvider();
}
