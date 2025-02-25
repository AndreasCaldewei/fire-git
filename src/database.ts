import { Octokit } from "@octokit/rest";

/**
 * Document data returned from a get operation
 */
export interface DocumentData {
  id: string;
  exists: boolean;
  data: any | null;
  path: string;
}

/**
 * Collection results returned from a get operation
 */
export interface CollectionData {
  docs: DocumentData[];
  empty: boolean;
}

/**
 * Options for the GitHubDB constructor
 */
export interface GitHubDBOptions {
  owner: string;
  repo: string;
  branch?: string;
  basePath?: string;
}

/**
 * Options for the set operation
 */
export interface SetOptions {
  merge?: boolean;
}

/**
 * GitHubDB - Simple document database using GitHub as storage with a Firestore-like API
 */
export class FireGit {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private branch: string;
  private basePath: string;

  constructor(octoKit: Octokit, options: GitHubDBOptions) {
    this.octokit = octoKit;
    this.owner = options.owner;
    this.repo = options.repo;
    this.branch = options.branch || "main";
    this.basePath = options.basePath || "";
  }

  /**
   * Get a reference to a collection
   * @param collectionPath - The collection path
   * @returns A Collection object
   */
  collection(collectionPath: string): Collection {
    return new Collection(this, collectionPath);
  }

  /**
   * Get a reference to a document
   * @param documentPath - The full document path (collection/docId)
   * @returns A Document object
   */
  doc(documentPath: string): Document {
    const parts = documentPath.split("/");
    if (parts.length % 2 !== 0) {
      throw new Error(
        "Invalid document path. Should be collection/doc/collection/doc/...",
      );
    }

    // Extract collection path and document ID
    const collectionPath = parts.slice(0, parts.length - 1).join("/");
    const docId = parts[parts.length - 1];

    return this.collection(collectionPath).doc(docId);
  }

  /**
   * Get the full path for a document or collection
   * @param path - The path relative to basePath
   * @returns The full path
   */
  _getFullPath(path: string): string {
    return this.basePath ? `${this.basePath}/${path}` : path;
  }
}

/**
 * Collection class for Firestore-like interface
 */
export class Collection {
  private db: FireGit;
  path: string;

  constructor(db: FireGit, path: string) {
    this.db = db;
    this.path = path;
  }

  /**
   * Get a document reference
   * @param docId - The document ID
   * @returns A Document reference
   */
  doc(docId: string): Document {
    return new Document(this.db, `${this.path}/${docId}`);
  }

  /**
   * Add a new document with auto-generated ID
   * @param data - The document data
   * @returns Reference to the created document
   */
  async add(data: any): Promise<Document> {
    const id = this._generateId();
    const docRef = this.doc(id);
    await docRef.set(data);
    return docRef;
  }

  /**
   * Get all documents in a collection
   * @returns Collection result with documents
   */
  async get(): Promise<CollectionData> {
    try {
      const fullPath = (this.db as any)._getFullPath(this.path);
      try {
        const { data } = await (this.db as any).octokit.repos.getContent({
          owner: (this.db as any).owner,
          repo: (this.db as any).repo,
          path: fullPath,
          ref: (this.db as any).branch,
        });
        // If this is a single file, not a directory
        if (!Array.isArray(data)) {
          throw new Error(
            `Expected a collection but found a file at ${this.path}`,
          );
        }
        // Get all documents in the collection
        const docs = data.filter(
          (item: any) => item.type === "file" && item.name.endsWith(".json"),
        );

        // Use Promise.all to fetch all documents concurrently
        const results = await Promise.all(
          docs.map(async (doc: any) => {
            const id = doc.name.replace(".json", "");
            const docRef = this.doc(id);
            return docRef.get();
          }),
        );

        // Return a simplified result with just the documents
        return {
          docs: results,
          empty: results.length === 0,
        };
      } catch (error: any) {
        if (error.status === 404) {
          // Collection doesn't exist, return empty
          return {
            docs: [],
            empty: true,
          };
        }
        throw error;
      }
    } catch (error: any) {
      throw new Error(`Failed to get collection: ${error.message}`);
    }
  }

  /**
   * Generate a random document ID
   * @returns A random ID
   * @private
   */
  private _generateId(): string {
    return crypto.randomUUID();
  }
}

/**
 * Document class for Firestore-like interface
 */
export class Document {
  private db: FireGit;
  path: string;
  id: string;
  collection: string;

  constructor(db: FireGit, path: string) {
    this.db = db;
    this.path = path;

    // Extract ID from path (last segment)
    const segments = path.split("/");
    this.id = segments[segments.length - 1];

    // Extract collection path
    this.collection = segments.slice(0, segments.length - 1).join("/");
  }

  /**
   * Set document data
   * @param data - The document data
   * @param options - Options like {merge: true}
   * @returns Document reference
   */
  async set(data: any, options: SetOptions = {}): Promise<Document> {
    try {
      const fullPath = (this.db as any)._getFullPath(`${this.path}.json`);
      let sha: string | undefined;

      // Check if document exists if we need to merge
      if (options.merge) {
        try {
          const { data: fileData } = await (
            this.db as any
          ).octokit.repos.getContent({
            owner: (this.db as any).owner,
            repo: (this.db as any).repo,
            path: fullPath,
            ref: (this.db as any).branch,
          });

          sha = fileData.sha;

          // If merging, get existing data and merge with new data
          const content = Buffer.from(fileData.content, "base64").toString(
            "utf8",
          );
          const existingData = JSON.parse(content);
          data = { ...existingData, ...data };
        } catch (error: any) {
          if (error.status !== 404) {
            throw error;
          }
          // Document doesn't exist, just use the new data
        }
      } else {
        // If not merging, check for SHA for updating
        try {
          const { data: fileData } = await (
            this.db as any
          ).octokit.repos.getContent({
            owner: (this.db as any).owner,
            repo: (this.db as any).repo,
            path: fullPath,
            ref: (this.db as any).branch,
          });
          sha = fileData.sha;
        } catch (error: any) {
          if (error.status !== 404) {
            throw error;
          }
          // Document doesn't exist, will be created
        }
      }

      // Prepare content
      const content = Buffer.from(JSON.stringify(data, null, 2)).toString(
        "base64",
      );

      // Create or update the document
      const commitMessage = sha
        ? `Update document '${this.id}' in '${this.collection}'`
        : `Create document '${this.id}' in '${this.collection}'`;

      const params: any = {
        owner: (this.db as any).owner,
        repo: (this.db as any).repo,
        path: fullPath,
        message: commitMessage,
        content,
        branch: (this.db as any).branch,
      };

      if (sha) {
        params.sha = sha;
      }

      await (this.db as any).octokit.repos.createOrUpdateFileContents(params);

      return this;
    } catch (error: any) {
      throw new Error(`Failed to set document: ${error.message}`);
    }
  }

  /**
   * Update a document (merge)
   * @param data - The partial data to update
   * @returns Document reference
   */
  async update(data: any): Promise<Document> {
    return this.set(data, { merge: true });
  }

  /**
   * Get a document
   * @returns The document data
   */
  async get(): Promise<DocumentData> {
    try {
      const fullPath = (this.db as any)._getFullPath(`${this.path}.json`);

      try {
        const { data } = await (this.db as any).octokit.repos.getContent({
          owner: (this.db as any).owner,
          repo: (this.db as any).repo,
          path: fullPath,
          ref: (this.db as any).branch,
        });

        // Decode the content
        const content = Buffer.from(data.content, "base64").toString("utf8");
        const documentData = JSON.parse(content);

        // Return just the document data with minimal metadata
        return {
          id: this.id,
          exists: true,
          data: documentData,
          path: this.path,
        };
      } catch (error: any) {
        if (error.status === 404) {
          // Document doesn't exist
          return {
            id: this.id,
            exists: false,
            data: null,
            path: this.path,
          };
        }
        throw error;
      }
    } catch (error: any) {
      throw new Error(`Failed to get document: ${error.message}`);
    }
  }

  /**
   * Delete a document
   * @returns Success status
   */
  async delete(): Promise<boolean> {
    try {
      const fullPath = (this.db as any)._getFullPath(`${this.path}.json`);

      try {
        // Get the document's SHA
        const { data } = await (this.db as any).octokit.repos.getContent({
          owner: (this.db as any).owner,
          repo: (this.db as any).repo,
          path: fullPath,
          ref: (this.db as any).branch,
        });

        // Delete the document
        await (this.db as any).octokit.repos.deleteFile({
          owner: (this.db as any).owner,
          repo: (this.db as any).repo,
          path: fullPath,
          message: `Delete document '${this.id}' from '${this.collection}'`,
          sha: data.sha,
          branch: (this.db as any).branch,
        });

        return true;
      } catch (error: any) {
        if (error.status === 404) {
          // Document doesn't exist, treat as success
          return true;
        }
        throw error;
      }
    } catch (error: any) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }
}

// Export the database class
export default FireGit;
