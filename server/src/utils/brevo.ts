/**
 * Minimal client for Brevo's transactional email API
 * (https://api.brevo.com/v3/smtp/email). No SDK dependency needed \u2014 it's
 * one JSON POST with an API-key header.
 *
 * Requires BREVO_API_KEY and BREVO_SENDER_EMAIL in .env. If either is
 * missing, sendEmail() throws rather than silently pretending to send \u2014
 * an auth flow that "succeeds" without actually delivering a code would be
 * far worse than a clear startup/runtime error.
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms";

export interface SendEmailInput {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? "FuelMaster";

  if (!apiKey || !senderEmail) {
    throw new Error(
      "BREVO_API_KEY and BREVO_SENDER_EMAIL must be set in .env to send verification emails."
    );
  }

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: input.to, name: input.toName ?? input.to }],
      subject: input.subject,
      htmlContent: input.htmlContent,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${body}`);
  }
}

export function verificationCodeEmail(code: string, context: string): string {
  return `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #101922; margin-bottom: 4px;">FuelMaster</h2>
      <p style="color: #4b5b68; font-size: 14px;">${context}</p>
      <div style="background: #f3f5f7; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #101922;">${code}</span>
      </div>
      <p style="color: #7c8a97; font-size: 12.5px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

export interface SendSmsInput {
  to: string; // E.164 format, e.g. +254712345678
  content: string;
}

/**
 * Sends a real SMS via Brevo's transactional SMS API \u2014 the same account
 * used for email, Brevo is a multi-channel platform so no separate
 * integration is needed. Requires BREVO_SMS_SENDER (an approved sender
 * name, max 11 alphanumeric characters, registered in your Brevo account)
 * in addition to BREVO_API_KEY.
 */
export async function sendSms(input: SendSmsInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER;

  if (!apiKey || !sender) {
    throw new Error("BREVO_API_KEY and BREVO_SMS_SENDER must be set in .env to send SMS notifications.");
  }

  const res = await fetch(BREVO_SMS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender,
      recipient: input.to,
      content: input.content,
      type: "transactional",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo SMS send failed (${res.status}): ${body}`);
  }
}