import { pinyin } from 'pinyin';

// Map accented vowels/letters to ASCII equivalents
const ACCENT_MAP: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v',
};

/**
 * Convert a Chinese title to a URL-friendly slug using pinyin.
 * e.g. "前端开发手册" → "qianduankaifashouce-ab12"
 */
export function titleToSlug(title: string): string {
  try {
    const raw = pinyin(title, { style: 0 })
      .flat()
      .join('');

    // Strip tone marks → ASCII
    const ascii = raw
      .split('')
      .map((ch) => ACCENT_MAP[ch] ?? ch)
      .join('');

    const slug = ascii
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

    const hash = Math.random().toString(36).slice(2, 6);
    return slug ? `${slug}-${hash}` : `kb-${hash}`;
  } catch {
    return `kb-${Math.random().toString(36).slice(2, 10)}`;
  }
}
