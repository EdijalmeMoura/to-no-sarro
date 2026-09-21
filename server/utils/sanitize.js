// Sanitização XSS - remove tags HTML e caracteres perigosos
// Mantém texto legível mas remove scripts

export function stripTags(str) {
  if (typeof str !== "string") return str;
  // Remove tags HTML
  return str.replace(/<[^>]*>/g, "").trim();
}

export function sanitizeText(str, maxLen = 500) {
  if (typeof str !== "string") return "";
  let clean = stripTags(str);
  // Remove caracteres de controle e normaliza espaços
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  clean = clean.replace(/\s+/g, " ").trim();
  if (clean.length > maxLen) clean = clean.slice(0, maxLen).trim();
  return clean;
}

export function sanitizeCustomer(customer) {
  if (!customer || typeof customer !== "object") return customer;
  return {
    name: sanitizeText(customer.name, 80),
    phone: String(customer.phone || "").replace(/[^\d+\-() ]/g, "").trim().slice(0, 20),
    addr: sanitizeText(customer.addr, 200),
  };
}

export function sanitizeOrderNote(note) {
  return sanitizeText(note, 200);
}

export function sanitizeProductName(name) {
  return sanitizeText(name, 80);
}

// Middleware para sanitizar body automaticamente
export function xssSanitizer(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    // Sanitiza campos comuns que podem conter XSS
    const fieldsToSanitize = ["name", "note", "description", "addr", "address", "hours", "store_name", "whatsapp"];
    
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== "object") return;
      for (const key of Object.keys(obj)) {
        if (fieldsToSanitize.includes(key) && typeof obj[key] === "string") {
          obj[key] = sanitizeText(obj[key], key === "note" ? 200 : key === "description" ? 500 : 200);
        } else if (typeof obj[key] === "object") {
          sanitizeObject(obj[key]);
        }
      }
    };
    
    sanitizeObject(req.body);
  }
  next();
}
