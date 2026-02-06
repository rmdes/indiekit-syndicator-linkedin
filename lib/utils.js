import { htmlToText } from "html-to-text";
import { JSDOM } from "jsdom";

/**
 * Convert HTML to plain text suitable for LinkedIn commentary
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
export function htmlToPlainText(html) {
  return htmlToText(html, {
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
    ],
    wordwrap: false,
  });
}

/**
 * Truncate text to fit within character limit, appending permalink
 * @param {string} text - Text to truncate
 * @param {string} [permalink] - Post permalink URL
 * @param {number} limit - Character limit
 * @returns {string} Truncated text
 */
export function truncateWithPermalink(text, permalink, limit) {
  if (!text) return permalink || "";

  if (permalink && !text.includes(permalink)) {
    const suffix = `\n\n${permalink}`;
    const available = limit - suffix.length;
    if (text.length > available) {
      return text.slice(0, available - 1).trim() + "\u2026" + suffix;
    }
    return text + suffix;
  }

  if (text.length > limit) {
    return text.slice(0, limit - 1).trim() + "\u2026";
  }

  return text;
}

/**
 * Create commentary text for a LinkedIn post from JF2 properties
 * @param {object} properties - JF2 properties
 * @param {object} [options] - Options
 * @param {number} [options.characterLimit] - Character limit (default 3000)
 * @param {boolean} [options.isArticle] - Whether this is commentary for an article post
 * @returns {string} Commentary text
 */
export function createNoteContent(properties, options = {}) {
  const { characterLimit = 3000, isArticle = false } = options;

  let text = "";

  if (isArticle) {
    // For articles, prefer summary as teaser (the article card shows full title/description)
    if (properties.summary) {
      text = properties.summary;
    } else if (properties.content?.html) {
      text = htmlToPlainText(properties.content.html);
    } else if (properties.content?.text) {
      text = properties.content.text;
    }
  } else {
    // For notes, use full content
    if (properties.content?.html) {
      text = htmlToPlainText(properties.content.html);
    } else if (properties.content?.text) {
      text = properties.content.text;
    } else if (properties.name) {
      text = properties.name;
    }
  }

  return truncateWithPermalink(text, properties.url, characterLimit);
}

/**
 * Create article content object for LinkedIn article post
 * @param {object} properties - JF2 properties
 * @returns {{ source: string, title: string, description: string }}
 */
export function createArticleContent(properties) {
  const source = properties.url;
  const title = properties.name || "Untitled";

  let description = "";
  if (properties.summary) {
    description = properties.summary;
  } else if (properties.content?.html) {
    description = htmlToPlainText(properties.content.html);
  } else if (properties.content?.text) {
    description = properties.content.text;
  }

  // LinkedIn article description has practical limits
  if (description.length > 256) {
    description = description.slice(0, 255).trim() + "\u2026";
  }

  return { source, title, description };
}

/**
 * Fetch Open Graph image URL from a web page
 * @param {string} url - URL to scrape
 * @returns {Promise<string|null>} OG image URL or null
 */
export async function fetchOpenGraphImage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IndiekitBot/1.0)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage?.content) return ogImage.content;

    const twitterImage = doc.querySelector('meta[name="twitter:image"]');
    if (twitterImage?.content) return twitterImage.content;

    return null;
  } catch {
    return null;
  }
}
