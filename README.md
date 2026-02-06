# @rmdes/indiekit-syndicator-linkedin

LinkedIn syndicator for [Indiekit](https://getindiekit.com), supporting notes (short text) and articles (long-form with URL card).

Originally based on work by [Giacomo Debidda](https://giacomodebidda.com) ([jackdbd](https://github.com/jackdbd)), from an unmerged [pull request](https://github.com/jackdbd/indiekit/tree/feat/531-linkedin-syndicator) to the Indiekit monorepo.

## Installation

```bash
npm install @rmdes/indiekit-syndicator-linkedin
```

## Requirements

- A LinkedIn account with a [registered application](https://www.linkedin.com/developers/apps)
- OAuth scopes: `openid`, `profile`, `w_member_social`
- A valid access token stored in the `LINKEDIN_ACCESS_TOKEN` environment variable

## Usage

Add to your Indiekit configuration:

```js
export default {
  plugins: ["@rmdes/indiekit-syndicator-linkedin"],
  "@rmdes/indiekit-syndicator-linkedin": {
    authorName: "Your Name",
    authorProfileUrl: "https://www.linkedin.com/in/yourname",
    checked: true,
  },
};
```

## Options

| Option             | Type    | Default    | Description                           |
| ------------------ | ------- | ---------- | ------------------------------------- |
| `accessToken`      | string  | env var    | LinkedIn API access token             |
| `authorName`       | string  | `""`       | Your name as shown on LinkedIn        |
| `authorProfileUrl` | string  | `""`       | Your LinkedIn profile URL             |
| `characterLimit`   | number  | `3000`     | LinkedIn post character limit         |
| `checked`          | boolean | `false`    | Pre-check syndicator in Indiekit UI   |
| `postsAPIVersion`  | string  | `"202601"` | LinkedIn API version (YYYYMM format)  |

## Supported Post Types

- **Notes**: Short text posts, syndicated as LinkedIn text posts with a permalink
- **Articles**: Long-form posts with a title, syndicated as LinkedIn article cards with URL, title, description, and thumbnail image. Thumbnails are resolved automatically: first from the post's featured photo, then by scraping the article's Open Graph image tag.

## Known Limitations

- **Token expiration**: LinkedIn access tokens expire (typically after 60 days). You will need to refresh your token manually. A companion OAuth endpoint package (`@rmdes/indiekit-endpoint-linkedin`) is planned to handle token acquisition through the Indiekit UI.

## Credits

This package is based on the LinkedIn syndicator originally written by [Giacomo Debidda](https://giacomodebidda.com) as an unmerged PR to the [Indiekit monorepo](https://github.com/getindiekit/indiekit). Extended with article post support and adapted as a standalone package.

## License

MIT
