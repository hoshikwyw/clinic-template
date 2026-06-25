/**
 * Email adapter — provider-agnostic. Uses Resend when RESEND_API_KEY is set,
 * otherwise a console no-op so everything works without an email provider.
 *
 * Vendor-wrapping: swapping providers = a new EmailProvider, nothing else.
 * See docs/01-tech-stack.md and docs/05-web-mobile-strategy.md.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<void>;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(msg: EmailMessage): Promise<void> {
    console.log(
      `[email:noop] to=${msg.to} subject="${msg.subject}" (set RESEND_API_KEY to actually send)`
    );
  }
}

class ResendEmailProvider implements EmailProvider {
  constructor(
    private apiKey: string,
    private from: string
  ) {}

  async send(msg: EmailMessage): Promise<void> {
    const { Resend } = await import("resend");
    const resend = new Resend(this.apiKey);
    const { error } = await resend.emails.send({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });
    if (error) throw new Error(error.message);
  }
}

export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Clinic <onboarding@resend.dev>";
  if (apiKey) return new ResendEmailProvider(apiKey, from);
  return new ConsoleEmailProvider();
}
