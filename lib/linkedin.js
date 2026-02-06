import { RestliClient } from "linkedin-api-client";
import { createNoteContent, createArticleContent } from "./utils.js";

export class LinkedIn {
  /**
   * @param {object} options
   * @param {string} options.accessToken - LinkedIn access token
   * @param {number} [options.characterLimit] - Character limit (default 3000)
   * @param {string} [options.postsAPIVersion] - API version string (YYYYMM)
   */
  constructor(options) {
    this.accessToken = options.accessToken;
    this.characterLimit = options.characterLimit || 3000;
    this.postsAPIVersion = options.postsAPIVersion || "202601";
  }

  /**
   * Get LinkedIn user info (id, name, URN)
   * The /userinfo endpoint is unversioned and requires the `openid` OAuth scope
   * @returns {Promise<{id: string, name: string, urn: string}>}
   */
  async getUserInfo() {
    const client = new RestliClient();
    const response = await client.get({
      accessToken: this.accessToken,
      resourcePath: "/userinfo",
    });
    const id = response.data.sub;
    return { id, name: response.data.name, urn: `urn:li:person:${id}` };
  }

  /**
   * Create a text-only post (note) on LinkedIn
   * @param {string} authorUrn - LinkedIn author URN
   * @param {string} commentary - Post text content
   * @returns {Promise<string>} Syndicated post URL
   */
  async createTextPost(authorUrn, commentary) {
    const client = new RestliClient();
    const response = await client.create({
      accessToken: this.accessToken,
      resourcePath: "/posts",
      entity: {
        author: authorUrn,
        commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
      versionString: this.postsAPIVersion,
    });
    return `https://www.linkedin.com/feed/update/${response.createdEntityId}/`;
  }

  /**
   * Create an article post with URL card on LinkedIn
   * @param {string} authorUrn - LinkedIn author URN
   * @param {string} commentary - Post text content (teaser)
   * @param {object} article - Article metadata
   * @param {string} article.source - Article URL
   * @param {string} article.title - Article title
   * @param {string} article.description - Article description
   * @returns {Promise<string>} Syndicated post URL
   */
  async createArticlePost(authorUrn, commentary, article) {
    const client = new RestliClient();
    const response = await client.create({
      accessToken: this.accessToken,
      resourcePath: "/posts",
      entity: {
        author: authorUrn,
        commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          article: {
            source: article.source,
            title: article.title,
            description: article.description,
          },
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
      versionString: this.postsAPIVersion,
    });
    return `https://www.linkedin.com/feed/update/${response.createdEntityId}/`;
  }

  /**
   * Post to LinkedIn — dispatches to the appropriate post type
   * @param {object} properties - JF2 post properties
   * @returns {Promise<string>} Syndicated post URL
   */
  async post(properties) {
    const { urn: authorUrn } = await this.getUserInfo();

    const postType = properties["post-type"];

    if (postType === "article") {
      const article = createArticleContent(properties);
      const commentary = createNoteContent(properties, {
        characterLimit: this.characterLimit,
        isArticle: true,
      });
      return this.createArticlePost(authorUrn, commentary, article);
    }

    // Default: note (text-only post)
    const commentary = createNoteContent(properties, {
      characterLimit: this.characterLimit,
    });
    return this.createTextPost(authorUrn, commentary);
  }
}
