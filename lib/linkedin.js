import { RestliClient } from "linkedin-api-client";
import {
  createNoteContent,
  createArticleContent,
  fetchOpenGraphImage,
} from "./utils.js";

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
   * Upload an image to LinkedIn via the Images API
   * @param {string} ownerUrn - Owner URN (urn:li:person:{id})
   * @param {string} imageUrl - URL of the image to upload
   * @returns {Promise<string|null>} LinkedIn image URN or null on failure
   */
  async uploadImage(ownerUrn, imageUrl) {
    try {
      const imageResponse = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; IndiekitBot/1.0)",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });

      if (!imageResponse.ok) return null;

      const imageBuffer = await imageResponse.arrayBuffer();

      // Initialize the upload via LinkedIn Images API
      const client = new RestliClient();
      const initResponse = await client.action({
        accessToken: this.accessToken,
        resourcePath: "/images",
        actionName: "initializeUpload",
        data: {
          initializeUploadRequest: {
            owner: ownerUrn,
          },
        },
        versionString: this.postsAPIVersion,
      });

      const { uploadUrl, image: imageUrn } = initResponse.data.value;

      // Upload the binary image to the provided URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: imageBuffer,
      });

      if (!uploadResponse.ok) return null;

      return imageUrn;
    } catch {
      return null;
    }
  }

  /**
   * Resolve a thumbnail image URN for an article post
   * Tries: 1) post photo property, 2) OG image from article URL
   * @param {string} ownerUrn - Owner URN
   * @param {object} properties - JF2 post properties
   * @returns {Promise<string|null>} LinkedIn image URN or null
   */
  async getArticleThumbnail(ownerUrn, properties) {
    // Try post's featured photo first
    if (properties.photo) {
      const photo = Array.isArray(properties.photo)
        ? properties.photo[0]
        : properties.photo;
      const photoUrl = typeof photo === "string" ? photo : photo?.url;
      if (photoUrl) {
        const urn = await this.uploadImage(ownerUrn, photoUrl);
        if (urn) return urn;
      }
    }

    // Fall back to OG image from the article URL
    if (properties.url) {
      const ogImageUrl = await fetchOpenGraphImage(properties.url);
      if (ogImageUrl) {
        return this.uploadImage(ownerUrn, ogImageUrl);
      }
    }

    return null;
  }

  /**
   * Create an article post with URL card on LinkedIn
   * @param {string} authorUrn - LinkedIn author URN
   * @param {string} commentary - Post text content (teaser)
   * @param {object} article - Article metadata
   * @param {string} article.source - Article URL
   * @param {string} article.title - Article title
   * @param {string} article.description - Article description
   * @param {string} [article.thumbnail] - LinkedIn image URN for thumbnail
   * @returns {Promise<string>} Syndicated post URL
   */
  async createArticlePost(authorUrn, commentary, article) {
    const client = new RestliClient();
    const articleEntity = {
      source: article.source,
      title: article.title,
      description: article.description,
    };

    if (article.thumbnail) {
      articleEntity.thumbnail = article.thumbnail;
    }

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
          article: articleEntity,
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

      // Resolve thumbnail: post photo → OG image → none
      const thumbnail = await this.getArticleThumbnail(authorUrn, properties);
      if (thumbnail) {
        article.thumbnail = thumbnail;
      }

      return this.createArticlePost(authorUrn, commentary, article);
    }

    // Default: note (text-only post)
    const commentary = createNoteContent(properties, {
      characterLimit: this.characterLimit,
    });
    return this.createTextPost(authorUrn, commentary);
  }
}
