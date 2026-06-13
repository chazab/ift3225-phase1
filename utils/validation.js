function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Client timestamps are optional, but when provided they must be valid ISO-like strings.
function parseTimestamp(value) {
  if (value === undefined) {
    return { ok: true, date: new Date() };
  }

  if (typeof value !== 'string') {
    return { ok: false };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { ok: false };
  }

  return { ok: true, date };
}

module.exports = {
  isNonEmptyString,
  parseTimestamp
};
