import Image from '@tiptap/extension-image';
import type { NodeViewRenderer } from '@tiptap/core';

import { isAllowedImageSrc } from './html-policy';

type ImageAlignment = 'left' | 'center' | 'right';

type ImagePresentation = {
  src: string;
  alt: string | null;
  width: number | null;
  alignment: ImageAlignment;
};

const IMAGE_WIDTH_PATTERN = /^[1-9][0-9]{0,4}$/;
const IMAGE_ALIGNMENTS = new Set<ImageAlignment>(['left', 'center', 'right']);

function parseImageWidth(value: string | null): number | null {
  if (value === null || !IMAGE_WIDTH_PATTERN.test(value)) {
    return null;
  }

  const width = Number(value);

  return width <= 10000 ? width : null;
}

function inlineStyleDeclarations(style: string): string[] {
  const declarations: string[] = [];
  const simpleBlocks: Array<{ closer: ')' | ']' | '}'; urlToken: boolean }> = [];
  let declaration = '';
  let quote: '"' | "'" | null = null;
  let comment = false;

  for (let index = 0; index < style.length; index += 1) {
    const character = style[index];

    if (comment) {
      if (character === '*' && style[index + 1] === '/') {
        comment = false;
        index += 1;
      }

      continue;
    }

    if (isEscaped(style, index)) {
      declaration += character;
      continue;
    }

    if (quote !== null) {
      if (character === quote) {
        quote = null;
      }

      declaration += character;
      continue;
    }

    if (character === '/' && style[index + 1] === '*') {
      declaration += ' ';
      comment = true;
      index += 1;
      continue;
    }

    const simpleBlock = simpleBlocks[simpleBlocks.length - 1];

    if (simpleBlock?.urlToken) {
      if (character === simpleBlock.closer) {
        simpleBlocks.pop();
      }

      declaration += character;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      declaration += character;
      continue;
    }

    if (character === simpleBlock?.closer) {
      simpleBlocks.pop();
      declaration += character;
      continue;
    }

    if (character === '(' || character === '[' || character === '{') {
      simpleBlocks.push({
        closer: character === '(' ? ')' : character === '[' ? ']' : '}',
        urlToken: character === '(' && startsUnquotedUrlToken(declaration, style, index),
      });
      declaration += character;
      continue;
    }

    if (character !== ';' || simpleBlocks.length !== 0) {
      declaration += character;
      continue;
    }

    declarations.push(declaration);
    declaration = '';
  }

  if (declaration !== '') {
    declarations.push(declaration);
  }

  return declarations;
}

function isUrlFunctionStart(value: string): boolean {
  const identifier = value.match(
    /(?:[-_a-z0-9]|\\(?:[0-9a-f]{1,6}[ \t\r\n\f]?|[^\r\n\f]))+$/i,
  )?.[0];

  return identifier !== undefined && canonicalizeCssIdentifier(identifier) === 'url';
}

function startsUnquotedUrlToken(value: string, style: string, openIndex: number): boolean {
  if (!isUrlFunctionStart(value)) {
    return false;
  }

  let cursor = openIndex + 1;

  while (cursor < style.length) {
    if (/[ \t\r\n\f]/.test(style[cursor] ?? '')) {
      cursor += 1;
      continue;
    }

    break;
  }

  return style[cursor] !== '"' && style[cursor] !== "'";
}

function isEscaped(value: string, index: number): boolean {
  let backslashes = 0;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }

  return backslashes % 2 === 1;
}

function declarationSeparator(declaration: string): number {
  for (let index = 0; index < declaration.length; index += 1) {
    if (declaration[index] === ':' && !isEscaped(declaration, index)) {
      return index;
    }
  }

  return -1;
}

function canonicalizeCssIdentifier(identifier: string): string | null {
  let canonical = '';
  let index = 0;

  while (index < identifier.length) {
    const character = identifier[index];

    if (character !== '\\') {
      canonical += character;
      index += 1;
      continue;
    }

    index += 1;

    if (index === identifier.length || /[\n\r\f]/.test(identifier[index] ?? '')) {
      return null;
    }

    let hexadecimal = '';

    while (hexadecimal.length < 6 && /[0-9a-f]/i.test(identifier[index] ?? '')) {
      hexadecimal += identifier[index];
      index += 1;
    }

    if (hexadecimal === '') {
      canonical += identifier[index];
      index += 1;
      continue;
    }

    const codePoint = Number.parseInt(hexadecimal, 16);
    const normalizedCodePoint =
      codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? 0xfffd
        : codePoint;

    canonical += String.fromCodePoint(normalizedCodePoint);

    if (/[\t\n\f\r ]/.test(identifier[index] ?? '')) {
      if (identifier[index] === '\r' && identifier[index + 1] === '\n') {
        index += 2;
      } else {
        index += 1;
      }
    }
  }

  return canonical.toLowerCase();
}

function canonicalizeDirectLonghandDeclaration(
  element: HTMLElement,
  declaration: string,
  property: string,
): string | null {
  const separator = declarationSeparator(declaration);

  if (separator === -1) {
    return null;
  }

  const name = canonicalizeCssIdentifier(declaration.slice(0, separator).trim());

  if (name !== property) {
    return null;
  }

  const probe = element.ownerDocument.createElement('img');

  probe.style.cssText = declaration;
  const serialized = probe.style.cssText;
  const serializedSeparator = declarationSeparator(serialized);

  if (serializedSeparator === -1) {
    return null;
  }

  const serializedName = canonicalizeCssIdentifier(serialized.slice(0, serializedSeparator).trim());

  if (serializedName !== property) {
    return null;
  }

  return `${property}:${declaration.slice(separator + 1)}`;
}

function getDirectLonghandValue(
  element: HTMLElement,
  style: string,
  property: string,
): string | null {
  const directDeclarations = inlineStyleDeclarations(style)
    .map((declaration) => canonicalizeDirectLonghandDeclaration(element, declaration, property))
    .filter((declaration): declaration is string => declaration !== null);

  if (directDeclarations.length === 0) {
    return null;
  }

  let cssomProperty = property;

  for (let index = 0; index < element.style.length; index += 1) {
    const declaredProperty = element.style.item(index);

    if (declaredProperty.toLowerCase() === property) {
      cssomProperty = declaredProperty;
      break;
    }
  }

  const originalValue = element.style.getPropertyValue(cssomProperty).trim().toLowerCase();

  if (originalValue !== '') {
    return originalValue;
  }

  const directLonghandProbe = element.ownerDocument.createElement('img');

  directLonghandProbe.style.cssText = directDeclarations.join(';');

  return directLonghandProbe.style.getPropertyValue(property).trim().toLowerCase() || null;
}

function isZeroMargin(value: string): boolean {
  return value === '0' || value === '0px';
}

function parseImageAlignment(element: HTMLElement): ImageAlignment {
  const style = element.getAttribute('style');

  if (style === null) {
    return 'left';
  }

  const marginLeft = getDirectLonghandValue(element, style, 'margin-left');
  const marginRight = getDirectLonghandValue(element, style, 'margin-right');

  if (marginLeft === null || marginRight === null) {
    return 'left';
  }

  if (isZeroMargin(marginLeft) && marginRight === 'auto') {
    return 'left';
  }

  if (marginLeft === 'auto' && marginRight === 'auto') {
    return 'center';
  }

  if (marginLeft === 'auto' && isZeroMargin(marginRight)) {
    return 'right';
  }

  return 'left';
}

function parseImagePresentation(element: HTMLElement): ImagePresentation | false {
  const src = element.getAttribute('src');

  if (src === null || !isAllowedImageSrc(src)) {
    return false;
  }

  return {
    src,
    alt: element.getAttribute('alt'),
    width: parseImageWidth(element.getAttribute('width')),
    alignment: parseImageAlignment(element),
  };
}

function parseImageAttribute<K extends keyof ImagePresentation>(
  element: HTMLElement,
  attribute: K,
): ImagePresentation[K] | null {
  const presentation = parseImagePresentation(element);

  return presentation === false ? null : presentation[attribute];
}

function isValidImageWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10000;
}

function isImageAlignment(value: unknown): value is ImageAlignment {
  return typeof value === 'string' && IMAGE_ALIGNMENTS.has(value as ImageAlignment);
}

function imageStyle(alignment: ImageAlignment): string {
  const margins =
    alignment === 'center'
      ? 'margin-left: auto; margin-right: auto'
      : alignment === 'right'
        ? 'margin-left: auto; margin-right: 0'
        : 'margin-left: 0; margin-right: auto';

  return `display: block; max-width: 100%; height: auto; ${margins}`;
}

export const SafeImage = Image.extend({
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => parseImageAttribute(element, 'src'),
      },
      alt: {
        default: null,
        parseHTML: (element: HTMLElement) => parseImageAttribute(element, 'alt'),
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => parseImageAttribute(element, 'width'),
      },
      alignment: {
        default: 'left',
        parseHTML: (element: HTMLElement) => parseImageAttribute(element, 'alignment'),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element: HTMLElement) => parseImagePresentation(element),
      },
    ];
  },
  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          if (typeof options.src !== 'string' || !isAllowedImageSrc(options.src)) {
            return false;
          }

          const presentation: ImagePresentation = {
            src: options.src,
            alt: typeof options.alt === 'string' ? options.alt : null,
            width: null,
            alignment: 'left',
          };

          return commands.insertContent({
            type: this.name,
            attrs: presentation,
          });
        },
    };
  },
  addInputRules() {
    return [];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, alt, width, alignment } = HTMLAttributes;

    if (typeof src !== 'string' || !isAllowedImageSrc(src)) {
      return ['span'];
    }

    const attributes: Record<string, string> = {
      src,
      style: imageStyle(isImageAlignment(alignment) ? alignment : 'left'),
    };

    if (typeof alt === 'string') {
      attributes.alt = alt;
    }

    if (isValidImageWidth(width)) {
      attributes.width = String(width);
    }

    return ['img', attributes];
  },
}).configure({ allowBase64: true, HTMLAttributes: {} });

/** 같은 image schema에 소비 module의 private NodeView renderer만 연결한다. */
export function createSafeImage(imageNodeViewRenderer?: NodeViewRenderer): typeof SafeImage {
  if (!imageNodeViewRenderer) {
    return SafeImage;
  }

  return SafeImage.extend({
    addNodeView() {
      return imageNodeViewRenderer;
    },
  });
}
