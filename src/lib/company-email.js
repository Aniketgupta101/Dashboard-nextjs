const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "zohomail.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "hey.com",
  "fastmail.com",
  "tutanota.com",
]);

const DISPOSABLE_DOMAIN_PARTS = [
  "tempmail",
  "10minutemail",
  "guerrillamail",
  "mailinator",
  "trashmail",
];

const ACADEMIC_DOMAIN_PARTS = [
  ".edu.",
  ".ac.",
  "college",
  "university",
  "institute",
  "school",
  "academy",
  "campus",
  "student",
  "tcet",
];

export function getEmailDomain(email) {
  const value = String(email || "").trim().toLowerCase();
  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) return null;
  return value.slice(atIndex + 1);
}

export function isCompanyEmail(email) {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) return false;
  if (domain.endsWith(".edu") || domain.endsWith(".ac.in") || domain.endsWith(".edu.in")) {
    return false;
  }
  if (DISPOSABLE_DOMAIN_PARTS.some((part) => domain.includes(part))) return false;
  if (ACADEMIC_DOMAIN_PARTS.some((part) => domain.includes(part))) return false;
  return domain.includes(".");
}

export function splitName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}
