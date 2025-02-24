# FireGit

A simple document database using GitHub as storage with a Firestore-like API.

[![npm version](https://badge.fury.io/js/firegit.svg)](https://badge.fury.io/js/firegit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 📄 Document-based storage using GitHub repositories
- 🔥 Firestore-like API for easy integration
- 🔄 Automatic versioning via Git history
- 🧩 Simple CRUD operations for documents and collections
- 🔐 Secure authentication using GitHub tokens

## Installation

```bash
npm install firegit
# or
yarn add firegit
```

## Quick Start

```typescript
import { Octokit } from "@octokit/rest";
import FireGit from "firegit";

// Initialize Octokit with your GitHub token
const octokit = new Octokit({
  auth: "your-github-token",
});

// Initialize FireGit
const db = new FireGit(octokit, {
  owner: "your-username",
  repo: "your-repo",
  branch: "main", // optional, defaults to "main"
  basePath: "data", // optional, defaults to root
});

// Add a document to a collection
async function addUser() {
  const usersCollection = db.collection("users");
  const newUser = await usersCollection.add({
    name: "John Doe",
    email: "john@example.com",
    createdAt: new Date().toISOString(),
  });

  console.log(`Created user with ID: ${newUser.id}`);
}

// Get a document
async function getUser(userId) {
  const userDoc = db.doc(`users/${userId}`);
  const userData = await userDoc.get();

  if (userData.exists) {
    console.log("User data:", userData.data);
  } else {
    console.log("User not found");
  }
}

// Update a document
async function updateUser(userId) {
  const userDoc = db.doc(`users/${userId}`);
  await userDoc.update({
    lastLogin: new Date().toISOString(),
  });

  console.log("User updated");
}

// Delete a document
async function deleteUser(userId) {
  const userDoc = db.doc(`users/${userId}`);
  await userDoc.delete();

  console.log("User deleted");
}

// Get all documents in a collection
async function getAllUsers() {
  const usersCollection = db.collection("users");
  const result = await usersCollection.get();

  if (result.empty) {
    console.log("No users found");
  } else {
    console.log(`Found ${result.docs.length} users:`);
    result.docs.forEach((doc) => {
      console.log(`${doc.id}: ${JSON.stringify(doc.data)}`);
    });
  }
}
```

## API Reference

### `FireGit`

The main class representing the database connection.

#### Constructor

```typescript
new FireGit(octokit: Octokit, options: GitHubDBOptions)
```

Parameters:

- `octokit`: An initialized Octokit instance
- `options`: Configuration options
  - `owner`: GitHub repository owner (username or organization)
  - `repo`: GitHub repository name
  - `branch`: (Optional) Branch to use (defaults to "main")
  - `basePath`: (Optional) Base path within the repository

#### Methods

##### `collection(collectionPath: string): Collection`

Get a reference to a collection.

Parameters:

- `collectionPath`: The path to the collection

Returns: A `Collection` object

##### `doc(documentPath: string): Document`

Get a reference to a document.

Parameters:

- `documentPath`: The full path to the document (e.g., "users/user123")

Returns: A `Document` object

### `Collection`

Represents a collection of documents.

#### Methods

##### `doc(docId: string): Document`

Get a reference to a document within this collection.

Parameters:

- `docId`: The document ID

Returns: A `Document` object

##### `add(data: any): Promise<Document>`

Add a new document with an auto-generated ID.

Parameters:

- `data`: The document data (will be stored as JSON)

Returns: A promise that resolves to the created `Document` reference

##### `get(): Promise<CollectionData>`

Get all documents in the collection.

Returns: A promise that resolves to a `CollectionData` object:

```typescript
interface CollectionData {
  docs: DocumentData[];
  empty: boolean;
}
```

### `Document`

Represents a document within a collection.

#### Properties

- `id`: The document ID
- `path`: The full path to the document
- `collection`: The path to the parent collection

#### Methods

##### `set(data: any, options?: SetOptions): Promise<Document>`

Set the document data.

Parameters:

- `data`: The document data (will be stored as JSON)
- `options`: (Optional) Set options
  - `merge`: If true, merges the data with existing document data

Returns: A promise that resolves to the `Document` reference

##### `update(data: any): Promise<Document>`

Update a document (shorthand for `set` with `merge: true`).

Parameters:

- `data`: The partial data to update

Returns: A promise that resolves to the `Document` reference

##### `get(): Promise<DocumentData>`

Get the document data.

Returns: A promise that resolves to a `DocumentData` object:

```typescript
interface DocumentData {
  id: string;
  exists: boolean;
  data: any | null;
  path: string;
}
```

##### `delete(): Promise<boolean>`

Delete the document.

Returns: A promise that resolves to a boolean indicating success

## Data Structure

Documents are stored as JSON files in your GitHub repository. The file structure follows the collection/document pattern:

```
/{basePath}/{collection}/{documentId}.json
```

For example, a user document might be stored at:

```
/data/users/abc123.json
```

## Use Cases

- Static websites with dynamic content
- Simple content management systems
- Storing application configuration
- Lightweight database for small applications
- Collaborative document editing with version history

## Advantages

- No database server required
- Built-in versioning via Git
- Simple REST API access via GitHub
- Free for public repositories (within GitHub's limits)
- Easy backup and migration

## Limitations

- Not suitable for high-frequency writes
- Limited query capabilities
- GitHub API rate limits apply
- Maximum file size restrictions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
