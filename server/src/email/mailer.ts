import nodemailer from "nodemailer";
import { config } from "../config.js";

const hasSmtpConfig = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!transporter) {
    // No SMTP credentials configured (normal for local development). Log
    // instead of failing so password-reset / notification flows are still
    // testable end to end without a real mail account.
    console.log(`[email:dev-mode] To: ${to}\nSubject: ${subject}\n\n${text}`);
    return;
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, text, html });
}

export function passwordResetEmail(username: string, resetUrl: string) {
  return {
    subject: "Reset your ChessLA password",
    text: `Hi ${username},\n\nWe received a request to reset your ChessLA password. This link expires in 1 hour:\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\n— ChessLA`,
  };
}
