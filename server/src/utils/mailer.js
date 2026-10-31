import nodemailer from 'nodemailer';

export async function sendMail({ to, subject, html }) {
  const port = Number(process.env.SMTP_PORT || 587);
  const transportOptions = {
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
  };

  if (process.env.SMTP_USER || process.env.SMTP_PASS) {
    transportOptions.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  const transport = nodemailer.createTransport(transportOptions);
  return transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@localhost',
    to,
    subject,
    html,
  });
}
