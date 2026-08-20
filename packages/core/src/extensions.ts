import type { AnyExtension } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

import { isAllowedImageSrc, isAllowedLinkHref } from './html-policy';

function parseCssColor(element: HTMLElement): string | null {
  const color = element.style.getPropertyValue('color').trim();

  return color || null;
}

const SafeTextStyle = TextStyle.extend({
  parseHTML() {
    return ['span', 'strong', 'em', 'u'].map((tag) => ({
      tag: `${tag}[style]`,
      consuming: false,
      getAttrs: (element: HTMLElement) => {
        const color = parseCssColor(element);

        return color === null ? false : { color };
      },
    }));
  },
});

const SafeColor = Color.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: parseCssColor,
            renderHTML: (attributes) =>
              attributes.color ? { style: `color: ${attributes.color}` } : {},
          },
        },
      },
    ];
  },
});

const SafeLink = Link.extend({
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const href = element.getAttribute('href');

          return href !== null && isAllowedLinkHref(href) ? href : null;
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'a[href]',
        getAttrs: (element: HTMLElement) => {
          const href = element.getAttribute('href');

          return href !== null && isAllowedLinkHref(href) ? {} : false;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const href = typeof HTMLAttributes.href === 'string' ? HTMLAttributes.href : '';

    return isAllowedLinkHref(href) ? ['a', { href }, 0] : ['span', 0];
  },
}).configure({
  autolink: false,
  HTMLAttributes: {},
  isAllowedUri: isAllowedLinkHref,
  openOnClick: false,
});

const SafeImage = Image.extend({
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const src = element.getAttribute('src');

          return src !== null && isAllowedImageSrc(src) ? src : null;
        },
      },
      alt: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('alt'),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element: HTMLElement) => {
          const src = element.getAttribute('src');

          if (src === null || !isAllowedImageSrc(src)) {
            return false;
          }

          return { src, alt: element.getAttribute('alt') };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const src = typeof HTMLAttributes.src === 'string' ? HTMLAttributes.src : '';

    if (!isAllowedImageSrc(src)) {
      return ['span'];
    }

    const alt = typeof HTMLAttributes.alt === 'string' ? HTMLAttributes.alt : undefined;

    return alt === undefined ? ['img', { src }] : ['img', { src, alt }];
  },
}).configure({ allowBase64: true, HTMLAttributes: {} });

/** HTML schema와 정규화 정책이 적용된 core extension 집합을 만든다. */
export function createHtmlEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({ link: false, underline: false }),
    Underline,
    SafeLink,
    SafeImage,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    SafeTextStyle,
    SafeColor,
    TableKit.configure({
      table: { HTMLAttributes: {}, resizable: false },
      tableCell: { HTMLAttributes: {} },
      tableHeader: { HTMLAttributes: {} },
      tableRow: { HTMLAttributes: {} },
    }),
  ];
}
