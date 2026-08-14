import { logComponent } from "@freeanima/habitat/platform/logging";

import { readAcmeAccount, writeAcmeAccount, type AcmeAccountStore } from "./acme-account.ts";
import { removeHttp01Challenge, setHttp01Challenge } from "./challenge-store.ts";

export type IssueAcmeCertificateOptions = {
  email: string;
  domains: string[];
  staging?: boolean;
  accountPath?: string;
};

export type IssuedAcmeCertificate = {
  certPem: string;
  keyPem: string;
};

async function loadOrCreateAccount(
  email: string,
  staging: boolean,
  accountPath: string | undefined,
): Promise<{ accountKeyPem: string; accountUrl?: string; directory: string }> {
  const acme = await import("acme-client");
  const dir = staging ? acme.directory.letsencrypt.staging : acme.directory.letsencrypt.production;
  const existing = readAcmeAccount(accountPath);
  if (
    existing &&
    existing.directoryUrl === dir &&
    existing.email.toLowerCase() === email.toLowerCase()
  ) {
    return {
      accountKeyPem: existing.accountKeyPem,
      accountUrl: existing.accountUrl,
      directory: dir,
    };
  }

  const accountKey = await acme.crypto.createPrivateKey();
  const accountKeyPem = accountKey.toString("utf-8");
  const client = new acme.Client({
    directoryUrl: dir,
    accountKey: accountKeyPem,
  });
  await client.createAccount({
    termsOfServiceAgreed: true,
    contact: [`mailto:${email}`],
  });
  const accountUrl = client.getAccountUrl();
  const store: AcmeAccountStore = {
    accountUrl,
    accountKeyPem,
    directoryUrl: dir,
    email,
  };
  writeAcmeAccount(store, accountPath);
  logComponent("startup").info("ACME 账号已创建", { email, staging, accountUrl });
  return { accountKeyPem, accountUrl, directory: dir };
}

/**
 * 向 Let's Encrypt 申请证书（HTTP-01）。调用前须已启动 challenge server。
 */
export async function issueAcmeCertificate(
  options: IssueAcmeCertificateOptions,
): Promise<IssuedAcmeCertificate> {
  const acme = await import("acme-client");
  const domains = options.domains.map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (domains.length === 0) {
    throw new Error("ACME domains 不能为空");
  }
  const staging = options.staging === true;
  const email = options.email.trim();
  const { accountKeyPem, accountUrl, directory } = await loadOrCreateAccount(
    email,
    staging,
    options.accountPath,
  );

  const client = new acme.Client({
    directoryUrl: directory,
    accountKey: accountKeyPem,
    ...(accountUrl ? { accountUrl } : {}),
  });

  const commonName = domains[0];
  if (!commonName) {
    throw new Error("ACME domains 不能为空");
  }
  const [keyPemBuf, csr] = await acme.crypto.createCsr({
    commonName,
    altNames: domains,
  });

  const certPem = await client.auto({
    csr,
    email,
    termsOfServiceAgreed: true,
    challengePriority: ["http-01"],
    challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
      if (challenge.type !== "http-01") {
        throw new Error(`不支持的 ACME challenge：${challenge.type}`);
      }
      setHttp01Challenge(challenge.token, keyAuthorization);
    },
    challengeRemoveFn: async (_authz, challenge) => {
      if (challenge.type === "http-01") {
        removeHttp01Challenge(challenge.token);
      }
    },
  });

  return {
    certPem: typeof certPem === "string" ? certPem : String(certPem),
    keyPem: keyPemBuf.toString("utf-8"),
  };
}
