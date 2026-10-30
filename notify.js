import nodemailer from "nodemailer";

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

/** Email the citizen a status update. Silently logs if SMTP is not configured. */
export async function notifyCitizen(to, subject, text) {
  if (!to) return { sent: false, reason: "no recipient" };
  if (!transporter) {
    console.log(`[notify:dry-run] to=${to} subject="${subject}"`);
    return { sent: false, reason: "smtp not configured" };
  }
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
  return { sent: true };
}
