# CLAUDE.md - @rmdes/indiekit-syndicator-linkedin

## Package Overview

`@rmdes/indiekit-syndicator-linkedin` is an Indiekit plugin that syndicates posts to LinkedIn using the LinkedIn REST API. It supports both short-form text posts (notes) and long-form posts with article cards (articles), with automatic thumbnail resolution from post photos or Open Graph images.

**Key Capabilities:**
- Syndicates IndieWeb notes as LinkedIn text posts
- Syndicates IndieWeb articles as LinkedIn article cards (title, description, thumbnail, URL)
- Automatic thumbnail resolution (post photo → OG image → none)
- HTML to plain text conversion
- Character limit enforcement with permalink appending
- LinkedIn Images API integration for thumbnail upload

**Version:** 1.0.2
**npm:** `@rmdes/indiekit-syndicator-linkedin`

**Credits:** Originally based on work by [Giacomo Debidda](https://giacomodebidda.com) ([jackdbd](https://github.com/jackdbd)) from an unmerged pull request to the Indiekit monorepo. Extended with article post support and adapted as a standalone package.

## Architecture

### LinkedIn REST API Integration

Built on `linkedin-api-client` (v0.3.0), using:
- `RestliClient` for authenticated API requests
- `/userinfo` endpoint (unversioned, requires `openid` scope) for user info
- `/posts` endpoint (versioned YYYYMM) for creating posts
- `/images` endpoint (versioned) for uploading thumbnails

### Data Flow

```
JF2 properties → LinkedIn.post()
  ├─ Determine post type (article vs note)
  ├─ Get user info → /userinfo → author URN
  ├─ For articles:
  │   ├─ Create article content (title, description, source URL)
  │   ├─ Resolve thumbnail (post photo → OG image)
  │   ├─ Upload thumbnail → /images initializeUpload + PUT
  │   ├─ Create commentary text
  │   └─ POST /posts with article embed
  └─ For notes:
      ├─ Create commentary text
      └─ POST /posts (text-only)
```

### Post Type Dispatch

| JF2 `post-type` | LinkedIn Post Type | Embed | Thumbnail |
|-----------------|-------------------|-------|-----------|
| `article` | Article card post | `content.article` with URL | Photo → OG image → none |
| `note` (default) | Text post | (none) | (none) |

## Key Files

### index.js

Entry point. Exports `LinkedInSyndicator` class with Indiekit plugin interface:
- `constructor(options)` - Accepts configuration
- `get info()` - Returns syndicator metadata for UI
- `get environment()` - Declares required env vars
- `async syndicate(properties, publication)` - Called by Indiekit to syndicate posts
- `init(Indiekit)` - Registers plugin with Indiekit

**Token resolution:** The plugin reads `this.options.accessToken` first, then falls back to `process.env.LINKEDIN_ACCESS_TOKEN`. This allows tokens set by `@rmdes/indiekit-endpoint-linkedin` (on startup restore or re-auth) to be picked up without restart.

### lib/linkedin.js

Core logic. `LinkedIn` class methods:
- `post(properties)` - Main dispatch method (article vs note)
- `getUserInfo()` - Fetches LinkedIn user info (id, name, URN) via `/userinfo`
- `createTextPost(authorUrn, commentary)` - Creates text-only post
- `createArticlePost(authorUrn, commentary, article)` - Creates post with article card
- `uploadImage(ownerUrn, imageUrl)` - Uploads image via Images API (initializeUpload + PUT)
- `getArticleThumbnail(ownerUrn, properties)` - Resolves thumbnail (photo → OG image)

### lib/utils.js

Utility functions:
- `createNoteContent(properties, options)` - Builds commentary text for notes/articles
- `createArticleContent(properties)` - Builds article metadata (title, description, source URL)
- `htmlToPlainText(html)` - Converts HTML to plain text (strips anchors, images)
- `truncateWithPermalink(text, permalink, limit)` - Truncates text, appends permalink
- `fetchOpenGraphImage(url)` - Fetches OG image URL from HTML (og:image, twitter:image)

## Configuration

### Constructor Options

```js
{
  accessToken: process.env.LINKEDIN_ACCESS_TOKEN, // LinkedIn API access token
  characterLimit: 3000,                           // LinkedIn post character limit
  checked: false,                                 // Pre-check in Indiekit UI
  postsAPIVersion: "202601",                      // LinkedIn API version (YYYYMM)
  authorName: "",                                 // Your name on LinkedIn
  authorProfileUrl: "",                           // Your LinkedIn profile URL
}
```

### Environment Variables

- `LINKEDIN_ACCESS_TOKEN` - LinkedIn API access token (required)

Tokens typically expire after 60 days. A companion OAuth endpoint package (`@rmdes/indiekit-endpoint-linkedin`) manages token acquisition and refresh.

## Inter-Plugin Relationships

**Depends on:**
- `@indiekit/indiekit` - Core plugin API
- `@indiekit/error` - Error handling

**Companion plugin:**
- `@rmdes/indiekit-endpoint-linkedin` - OAuth endpoint for token acquisition/refresh. Stores tokens in `process.env.LINKEDIN_ACCESS_TOKEN` on startup and after re-auth, which this syndicator picks up dynamically.

**Syndication flow:**
1. User creates post via Micropub (`@indiekit/endpoint-micropub`)
2. Post is saved with `syndicate-to[]` targeting LinkedIn
3. Indiekit calls `LinkedInSyndicator.syndicate(properties, publication)`
4. Plugin posts to LinkedIn, returns syndicated URL
5. URL is saved as `syndication` property in post file

## Known Gotchas

### Token Expiration

LinkedIn access tokens expire (typically 60 days). The plugin throws a 401 error if the token is missing or expired. The user must refresh the token via the OAuth endpoint or manually set a new token.

### API Versioning

LinkedIn Posts API is versioned (YYYYMM format). The default is `"202601"` (January 2026). If LinkedIn deprecates this version, update `postsAPIVersion` in the plugin config.

The `/userinfo` endpoint is unversioned and stable.

### OAuth Scopes

Required scopes:
- `openid` - For `/userinfo` endpoint
- `profile` - For user profile data
- `w_member_social` - For creating posts

These must be configured in the LinkedIn Developer App settings.

### Article Card Limits

LinkedIn article card fields have practical limits:
- **Title:** No hard limit, but kept reasonable (from `properties.name`)
- **Description:** 256 characters (enforced by `createArticleContent()`)
- **Source URL:** Must be the full URL of the article (from `properties.url`)

### Thumbnail Resolution Fallback

For article posts, the plugin attempts to find a thumbnail in this order:
1. Post's `photo` property (first photo if array)
2. Open Graph image from the article URL (`og:image` or `twitter:image`)
3. None (article card will have no thumbnail)

### Image Upload Timeout

The plugin uses a 15-second timeout for fetching images. If the image URL is slow or unreachable, thumbnail upload is skipped (no error thrown).

### Character Limit

LinkedIn's character limit is 3000 characters. The plugin truncates text if needed and appends the permalink. The truncation logic accounts for permalink length.

### Commentary for Articles

For article posts, the plugin prefers `properties.summary` as commentary text (teaser). If no summary exists, it falls back to `content.html` or `content.text`. The article card shows the full title and description, so the commentary should be a brief intro.

### Error Handling

The plugin wraps errors in `IndiekitError` with:
- HTTP status code (from LinkedIn API response or fallback to 500)
- Original error message
- Plugin name for debugging

## Dependencies

**Core:**
- `linkedin-api-client` ^0.3.0 - LinkedIn REST API client
- `html-to-text` ^9.0.0 - HTML to plain text conversion
- `jsdom` ^24.0.0 - HTML parsing for OG metadata

**Peer:**
- `@indiekit/indiekit` 1.x
- `@indiekit/error` ^1.0.0-beta.25

## Testing Notes

Manual testing against real LinkedIn API is required. No automated test suite exists.

**Test cases:**
- Note with text only
- Note with HTML content
- Article with title, summary, and OG image
- Article with post photo (should use as thumbnail)
- Article with no thumbnail (should post without thumb)
- Post with long content (check truncation + permalink)
- Post with expired token (check 401 error)

## API Version Migration

If LinkedIn deprecates the current API version (`202601`), update the default in `index.js`:

```js
const defaults = {
  postsAPIVersion: "202601", // Update this to new version
  // ...
};
```

LinkedIn typically announces deprecations 6-12 months in advance on the [LinkedIn Developer Portal](https://www.linkedin.com/developers/).
