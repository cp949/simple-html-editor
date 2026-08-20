const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'blob:']);
const IMAGE_DATA_PATTERN = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i;
const EXPLICIT_PROTOCOL_PATTERN = /^([a-z][a-z0-9+.-]*:)/i;

function isAllowedUrl(value: string, protocols: ReadonlySet<string>): boolean {
  const normalized = value.trim();
  // 브라우저가 scheme에서 무시하는 제어문자를 제거한 값으로 protocol을 판정한다.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: URL scheme 검사는 ASCII 제어문자를 제거해야 한다.
  const comparable = normalized.replace(/[\u0000-\u0020]/g, '');

  if (normalized.length === 0 || /^[\\/]{2}/.test(comparable)) {
    return false;
  }

  const protocol = EXPLICIT_PROTOCOL_PATTERN.exec(comparable)?.[1];

  return protocol === undefined || protocols.has(protocol.toLowerCase());
}

/** 링크로 저장할 수 있는 상대 경로와 protocol을 판정한다. */
export function isAllowedLinkHref(value: string): boolean {
  return isAllowedUrl(value, LINK_PROTOCOLS);
}

/** 이미지로 저장할 수 있는 URL과 bitmap data URL을 판정한다. */
export function isAllowedImageSrc(value: string): boolean {
  const normalized = value.trim();

  if (/^data:/i.test(normalized)) {
    return IMAGE_DATA_PATTERN.test(normalized);
  }

  return isAllowedUrl(normalized, IMAGE_PROTOCOLS);
}
