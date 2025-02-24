import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import FireGit, { Collection, Document } from "./database.js";
import { Octokit } from "@octokit/rest";

// Mock the Octokit constructor and its methods
vi.mock("@octokit/rest", () => {
  const mockOctokit = {
    repos: {
      getContent: vi.fn(),
      createOrUpdateFileContents: vi.fn(),
      deleteFile: vi.fn(),
    },
  };

  return {
    Octokit: vi.fn(() => mockOctokit),
  };
});

describe("GitHubDB", () => {
  let db: FireGit;
  let mockOctokit: any;

  beforeEach(() => {
    // Create a fresh instance for each test
    const octoKit = new Octokit({});
    db = new FireGit(octoKit, {
      auth: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      basePath: "data",
    });

    // Access the mocked Octokit instance
    mockOctokit = (db as any).octokit;

    // Reset all mock functions before each test
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with the provided options", () => {
      expect((db as any).owner).toBe("test-owner");
      expect((db as any).repo).toBe("test-repo");
      expect((db as any).branch).toBe("main");
      expect((db as any).basePath).toBe("data");
    });

    it("should use default values for optional parameters", () => {
      const octoKit = new Octokit({});
      const minimalDb = new FireGit(octoKit, {
        auth: "test-token",
        owner: "test-owner",
        repo: "test-repo",
      });

      expect((minimalDb as any).branch).toBe("main");
      expect((minimalDb as any).basePath).toBe("");
    });
  });

  describe("collection", () => {
    it("should return a Collection instance", () => {
      const collection = db.collection("users");
      expect(collection).toBeInstanceOf(Collection);
      expect(collection.path).toBe("users");
    });

    it("should support nested collection paths", () => {
      const collection = db.collection("users/123/posts");
      expect(collection).toBeInstanceOf(Collection);
      expect(collection.path).toBe("users/123/posts");
    });
  });

  describe("doc", () => {
    it("should return a Document instance", () => {
      const doc = db.doc("users/123");
      expect(doc).toBeInstanceOf(Document);
      expect(doc.id).toBe("123");
      expect(doc.collection).toBe("users");
      expect(doc.path).toBe("users/123");
    });

    it("should support deeply nested paths", () => {
      const doc = db.doc("users/123/posts/456/comments/789");
      expect(doc).toBeInstanceOf(Document);
      expect(doc.id).toBe("789");
      expect(doc.collection).toBe("users/123/posts/456/comments");
      expect(doc.path).toBe("users/123/posts/456/comments/789");
    });

    it("should throw an error for invalid paths", () => {
      expect(() => db.doc("users")).toThrow("Invalid document path");
      expect(() => db.doc("users/123/posts")).toThrow("Invalid document path");
    });
  });

  describe("_getFullPath", () => {
    it("should prepend basePath when provided", () => {
      expect((db as any)._getFullPath("users")).toBe("data/users");
      expect((db as any)._getFullPath("users/123")).toBe("data/users/123");
    });

    it("should return the path as is when no basePath is set", () => {
      const octoKit = new Octokit({});
      const noBasePathDb = new FireGit(octoKit, {
        auth: "test-token",
        owner: "test-owner",
        repo: "test-repo",
      });
      expect((noBasePathDb as any)._getFullPath("users")).toBe("users");
    });
  });
});

describe("Collection", () => {
  let db: FireGit;
  let collection: Collection;
  let mockOctokit: any;

  beforeEach(() => {
    // Create a fresh instance for each test
    const octoKit = new Octokit({});
    db = new FireGit(octoKit, {
      auth: "test-token",
      owner: "test-owner",
      repo: "test-repo",
    });
    collection = db.collection("users");
    mockOctokit = (db as any).octokit;

    // Reset all mock functions before each test
    vi.resetAllMocks();
  });

  describe("doc", () => {
    it("should return a Document instance with the correct path", () => {
      const doc = collection.doc("123");
      expect(doc).toBeInstanceOf(Document);
      expect(doc.id).toBe("123");
      expect(doc.path).toBe("users/123");
    });
  });

  describe("add", () => {
    it("should create a document with auto-generated ID and return its reference", async () => {
      // Mock the document set method
      const mockDocRef = {
        set: vi.fn().mockResolvedValue(undefined),
        id: "4fzzzxjylrx",
      } as unknown as Document;

      // Mock _generateId
      vi.spyOn(collection as any, "_generateId").mockReturnValue("4fzzzxjylrx");

      // Mock doc to return our mocked document reference
      vi.spyOn(collection, "doc").mockReturnValue(mockDocRef);

      const testData = { name: "Test User" };
      const result = await collection.add(testData);

      expect(collection.doc).toHaveBeenCalledWith("4fzzzxjylrx");
      expect(mockDocRef.set).toHaveBeenCalledWith(testData);
      expect(result).toBe(mockDocRef);
    });
  });

  describe("get", () => {
    it("should return all documents in the collection", async () => {
      // Mock the GitHub API response
      mockOctokit.repos.getContent.mockResolvedValue({
        data: [
          { name: "doc1.json", type: "file" },
          { name: "doc2.json", type: "file" },
          { name: "not-a-json.txt", type: "file" },
          { name: "subdir", type: "dir" },
        ],
      });

      // Mock document references and their get results
      const mockDoc1Result = {
        id: "doc1",
        exists: true,
        data: { name: "Document 1" },
        path: "users/doc1",
      };

      const mockDoc2Result = {
        id: "doc2",
        exists: true,
        data: { name: "Document 2" },
        path: "users/doc2",
      };

      // Create mock document references
      const mockDoc1 = {
        get: vi.fn().mockResolvedValue(mockDoc1Result),
      } as unknown as Document;

      const mockDoc2 = {
        get: vi.fn().mockResolvedValue(mockDoc2Result),
      } as unknown as Document;

      // Spy on doc method to return appropriate mock documents
      const docSpy = vi.spyOn(collection, "doc");
      docSpy.mockImplementation((id) => {
        if (id === "doc1") return mockDoc1;
        if (id === "doc2") return mockDoc2;
        return {} as Document;
      });

      const result = await collection.get();

      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        path: "users",
        ref: "main",
      });

      expect(docSpy).toHaveBeenCalledWith("doc1");
      expect(docSpy).toHaveBeenCalledWith("doc2");
      expect(mockDoc1.get).toHaveBeenCalled();
      expect(mockDoc2.get).toHaveBeenCalled();

      expect(result).toEqual({
        docs: [mockDoc1Result, mockDoc2Result],
        empty: false,
      });
    });

    it("should return empty result when collection does not exist", async () => {
      // Mock a 404 error from GitHub API
      const error = new Error("Not found");
      (error as any).status = 404;
      mockOctokit.repos.getContent.mockRejectedValue(error);

      const result = await collection.get();

      expect(result).toEqual({
        docs: [],
        empty: true,
      });
    });

    it("should throw error when API returns a non-array result", async () => {
      // Mock a file response instead of a directory
      mockOctokit.repos.getContent.mockResolvedValue({
        data: { type: "file", name: "users.json" },
      });

      await expect(collection.get()).rejects.toThrow(
        "Expected a collection but found a file",
      );
    });
  });
});

describe("Document", () => {
  let db: FireGit;
  let doc: Document;
  let mockOctokit: any;

  beforeEach(() => {
    // Create a fresh instance for each test
    const octoKit = new Octokit({});
    db = new FireGit(octoKit, {
      auth: "test-token",
      owner: "test-owner",
      repo: "test-repo",
    });
    doc = db.doc("users/123");
    mockOctokit = (db as any).octokit;

    // Reset all mock functions before each test
    vi.resetAllMocks();
  });

  describe("get", () => {
    it("should return the document data when it exists", async () => {
      const documentData = { name: "Test User", email: "test@example.com" };

      // Mock the GitHub API response
      mockOctokit.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify(documentData)).toString("base64"),
        },
      });

      const result = await doc.get();

      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        path: "users/123.json",
        ref: "main",
      });

      expect(result).toEqual({
        id: "123",
        exists: true,
        data: documentData,
        path: "users/123",
      });
    });

    it("should return non-existent document when it does not exist", async () => {
      // Mock a 404 error from GitHub API
      const error = new Error("Not found");
      (error as any).status = 404;
      mockOctokit.repos.getContent.mockRejectedValue(error);

      const result = await doc.get();

      expect(result).toEqual({
        id: "123",
        exists: false,
        data: null,
        path: "users/123",
      });
    });
  });

  describe("set", () => {
    it("should create a new document when it does not exist", async () => {
      const documentData = { name: "Test User", email: "test@example.com" };

      // Mock 404 for the initial check
      const notFoundError = new Error("Not found");
      (notFoundError as any).status = 404;
      mockOctokit.repos.getContent.mockRejectedValueOnce(notFoundError);

      // Mock successful creation
      mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { content: { sha: "new-sha" } },
      });

      await doc.set(documentData);

      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        path: "users/123.json",
        ref: "main",
      });

      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        {
          owner: "test-owner",
          repo: "test-repo",
          path: "users/123.json",
          message: "Create document '123' in 'users'",
          content: expect.any(String),
          branch: "main",
        },
      );

      // Verify the content is correct
      const callArgs =
        mockOctokit.repos.createOrUpdateFileContents.mock.calls[0][0];
      const decodedContent = JSON.parse(
        Buffer.from(callArgs.content, "base64").toString("utf8"),
      );
      expect(decodedContent).toEqual(documentData);
    });

    it("should update an existing document with sha", async () => {
      const documentData = {
        name: "Updated User",
        email: "updated@example.com",
      };

      // Mock existing document with SHA
      mockOctokit.repos.getContent.mockResolvedValue({
        data: {
          sha: "existing-sha",
          content: Buffer.from(JSON.stringify({ name: "Old Name" })).toString(
            "base64",
          ),
        },
      });

      // Mock successful update
      mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { content: { sha: "new-sha" } },
      });

      await doc.set(documentData);

      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        {
          owner: "test-owner",
          repo: "test-repo",
          path: "users/123.json",
          message: "Update document '123' in 'users'",
          content: expect.any(String),
          branch: "main",
          sha: "existing-sha",
        },
      );
    });
  });

  describe("update", () => {
    it("should merge data with existing document", async () => {
      const existingData = { name: "Test User", email: "test@example.com" };
      const updateData = { email: "updated@example.com", age: 30 };
      const expectedMergedData = {
        name: "Test User",
        email: "updated@example.com",
        age: 30,
      };

      // Mock existing document with SHA and content
      mockOctokit.repos.getContent.mockResolvedValue({
        data: {
          sha: "existing-sha",
          content: Buffer.from(JSON.stringify(existingData)).toString("base64"),
        },
      });

      // Mock successful update
      mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { content: { sha: "new-sha" } },
      });

      await doc.update(updateData);

      // Verify the update was called with merged data
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        {
          owner: "test-owner",
          repo: "test-repo",
          path: "users/123.json",
          message: "Update document '123' in 'users'",
          content: expect.any(String),
          branch: "main",
          sha: "existing-sha",
        },
      );

      // Verify the content contains the merged data
      const callArgs =
        mockOctokit.repos.createOrUpdateFileContents.mock.calls[0][0];
      const decodedContent = JSON.parse(
        Buffer.from(callArgs.content, "base64").toString("utf8"),
      );
      expect(decodedContent).toEqual(expectedMergedData);
    });
  });

  describe("delete", () => {
    it("should delete an existing document", async () => {
      // Mock existing document with SHA
      mockOctokit.repos.getContent.mockResolvedValue({
        data: { sha: "existing-sha" },
      });

      // Mock successful deletion
      mockOctokit.repos.deleteFile.mockResolvedValue({});

      const result = await doc.delete();

      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        path: "users/123.json",
        ref: "main",
      });

      expect(mockOctokit.repos.deleteFile).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        path: "users/123.json",
        message: "Delete document '123' from 'users'",
        sha: "existing-sha",
        branch: "main",
      });

      expect(result).toBe(true);
    });

    it("should return true when document does not exist", async () => {
      // Mock 404 for the document
      const notFoundError = new Error("Not found");
      (notFoundError as any).status = 404;
      mockOctokit.repos.getContent.mockRejectedValue(notFoundError);

      const result = await doc.delete();

      // Verify deleteFile was never called
      expect(mockOctokit.repos.deleteFile).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
