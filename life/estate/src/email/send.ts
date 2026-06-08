import nodemailer from "nodemailer";

import { resolveAccount, resolveAccountPassword } from "./accounts.ts";

export type SendEmailInput = {
  account_id?: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
};

function smtpSecure(port: number): boolean {
  if (port === 465) return true;
  if (port === 587 || port === 25) return false;
  return port > 465;
}

export async function sendEmail(input: SendEmailInput): Promise<{
  ok: true;
  messageId: string;
  account_id: string;
}> {
  const account = resolveAccount(input.account_id);
  const pass = await resolveAccountPassword(account);

  const transport = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: smtpSecure(account.smtp_port),
    auth: {
      user: account.address,
      pass,
    },
  });

  const info = await transport.sendMail({
    from: account.display_name
      ? { name: account.display_name, address: account.address }
      : account.address,
    to: input.to,
    cc: input.cc || undefined,
    bcc: input.bcc || undefined,
    subject: input.subject,
    text: input.body,
  });

  return {
    ok: true,
    messageId: info.messageId,
    account_id: account.id,
  };
}
