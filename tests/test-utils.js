const oneLiner = string =>
  string
    .replace(/(?:\r\n|\r|\n)/g, ' ')
    .replace(/\s\s+/g, ' ')
    .trim()

export { oneLiner }
