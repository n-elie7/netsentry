// validate, strips protocol, paths, and whitespace. Returns clean domain or null.

function sanitizeDomain(input) {
  if (!input || typeof input !== "string") return null;

  let domain = input.trim().toLowerCase();

  domain = domain.replace(/^https?:\/\//, "");

  domain = domain.split("/")[0];
  domain = domain.split("?")[0];
  domain = domain.split("#")[0];


  domain = domain.split(":")[0];

  domain = domain.replace(/^www\./, "");

  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
  if (!domainRegex.test(domain)) return null;

  return domain;
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = { sanitizeDomain, isNonEmpty };
