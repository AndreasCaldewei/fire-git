# FireGit

A simple document database using GitHub as storage with a Firestore-like API.

## Overview

FireGit allows you to use GitHub repositories as a document database, providing a familiar interface similar to Google Firestore. Store, retrieve, update, and delete JSON documents in your GitHub repositories with an intuitive API.

## Features

- **Firestore-like API**: Familiar methods like `collection()`, `doc()`, `get()`, `set()`, `update()`, and `delete()`
- **Document Collections**: Organize your data in collections and documents
- **Auto-generated IDs**: Create documents with auto-generated UUIDs
- **Merge Updates**: Update documents with merge option
- **Concurrent Operations**: Fetch multiple documents in parallel

## Installation

```bash
npm install firegit
```

## Usage

### Initialize the Database

```typescript
import { Octokit } from "@octokit/rest";
import FireGit from "firegit";

// Create an Octokit instance with your GitHub token
const octokit = new Octokit({
  auth: "your-github-token",
});

// Initialize FireGit
const db = new FireGit(octokit, {
  owner: "your-username",
  repo: "your-repo",
  branch: "main", // Optional, defaults to "main"
  basePath: "data", // Optional, defaults to root
});
```

### Working with Collections and Documents

```typescript
// Get a reference to a collection
const usersCollection = db.collection("users");

// Add a document with auto-generated ID
const newUserRef = await usersCollection.add({
  name: "John Doe",
  email: "john@example.com",
  createdAt: new Date().toISOString(),
});

console.log(`Created user with ID: ${newUserRef.id}`);

// Get a reference to a specific document
const userRef = db.doc("users/user123");

// Set document data (overwrites any existing data)
await userRef.set({
  name: "Jane Smith",
  email: "jane@example.com",
});

// Update a document (merges with existing data)
await userRef.update({
  lastLogin: new Date().toISOString(),
});

// Get a document
const userData = await userRef.get();
console.log(userData);

// Get all documents in a collection
const allUsers = await usersCollection.get();
console.log(`Found ${allUsers.docs.length} users`);
allUsers.docs.forEach((user) => {
  console.log(`User ${user.id}: ${user.name}`);
});

// Delete a document
await userRef.delete();
```

## Storage Structure

FireGit stores each document as a separate JSON file in your GitHub repository. For example:

- A document at path `users/user123` will be stored as `users/user123.json`
- Collections are represented as directories in the repository
- The structure mirrors your Firestore-like paths

## API Reference

### `FireGit`

The main database class.

```typescript
constructor(octoKit: Octokit, options: GitHubDBOptions)
```

- `octoKit`: An instance of Octokit
- `options`: Configuration options
  - `owner`: GitHub username or organization
  - `repo`: Repository name
  - `branch`: Branch name (optional, defaults to "main")
  - `basePath`: Base path in the repository (optional)

#### Methods

- `collection(collectionPath: string): Collection` - Get a reference to a collection
- `doc(documentPath: string): Document` - Get a reference to a document

### `Collection`

Represents a collection of documents.

#### Methods

- `doc(docId: string): Document` - Get a reference to a document in the collection
- `add(data: any): Promise<Document>` - Add a new document with auto-generated ID
- `get(): Promise<CollectionData>` - Get all documents in the collection

### `Document`

Represents a document in a collection.

#### Methods

- `set(data: any, options?: SetOptions): Promise<Document>` - Set document data
- `update(data: any): Promise<Document>` - Update document data (merge)
- `get(): Promise<DocumentData>` - Get document data
- `delete(): Promise<boolean>` - Delete the document

## Types

```typescript
// Document data returned from a get operation
interface DocumentData {
  id: string;
  [key: string]: any; // Allow dynamic properties
}

// Collection results returned from a get operation
interface CollectionData {
  docs: DocumentData[];
}

// Options for the set operation
interface SetOptions {
  merge?: boolean;
}
```

## Limitations

- Not suitable for high-frequency updates (GitHub API rate limits apply)
- No real-time listeners or complex queries
- No transactions or batched writes
- Limited to GitHub's file size constraints

## License

MIT
