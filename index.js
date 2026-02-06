import process from "node:process";
import { IndiekitError } from "@indiekit/error";
import { LinkedIn } from "./lib/linkedin.js";

const defaults = {
  accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
  characterLimit: 3000,
  checked: false,
  postsAPIVersion: "202601",
  authorName: "",
  authorProfileUrl: "",
};

export default class LinkedInSyndicator {
  name = "LinkedIn syndicator";

  /**
   * @param {object} [options] - Plug-in options
   * @param {string} [options.accessToken] - LinkedIn access token
   * @param {number} [options.characterLimit] - Character limit (default 3000)
   * @param {boolean} [options.checked] - Check syndicator in UI
   * @param {string} [options.postsAPIVersion] - LinkedIn API version (YYYYMM)
   * @param {string} [options.authorName] - Author display name
   * @param {string} [options.authorProfileUrl] - LinkedIn profile URL
   */
  constructor(options = {}) {
    this.options = { ...defaults, ...options };
  }

  get environment() {
    return ["LINKEDIN_ACCESS_TOKEN"];
  }

  get info() {
    const name = this.options.authorName || "LinkedIn user";
    const uid = this.options.authorProfileUrl || "https://www.linkedin.com/";
    const url = this.options.authorProfileUrl || "https://www.linkedin.com/";

    const info = {
      checked: this.options.checked,
      name,
      uid,
      service: {
        name: "LinkedIn",
        photo: "/assets/@rmdes-indiekit-syndicator-linkedin/icon.svg",
        url: "https://www.linkedin.com/",
      },
      user: {
        name,
        url,
      },
    };

    if (!this.options.authorName) {
      info.error = "Author name not configured";
    }

    return info;
  }

  get prompts() {
    return [
      {
        type: "text",
        name: "authorName",
        message: "What is your name on LinkedIn?",
      },
      {
        type: "text",
        name: "authorProfileUrl",
        message: "What is your LinkedIn profile URL?",
        validate: (value) =>
          URL.canParse(value)
            ? true
            : "Enter a valid URL, e.g. https://www.linkedin.com/in/yourname",
      },
    ];
  }

  async syndicate(properties, publication) {
    try {
      const linkedin = new LinkedIn({
        accessToken: this.options.accessToken,
        characterLimit: this.options.characterLimit,
        postsAPIVersion: this.options.postsAPIVersion,
      });

      return await linkedin.post(properties);
    } catch (error) {
      const status =
        error.response?.status || error.status || error.statusCode || 500;
      const message = error.response?.statusText
        ? `Could not create LinkedIn post: ${error.response.statusText}`
        : error.message;
      throw new IndiekitError(message, {
        cause: error,
        plugin: this.name,
        status,
      });
    }
  }

  init(Indiekit) {
    Indiekit.addSyndicator(this);
  }
}
