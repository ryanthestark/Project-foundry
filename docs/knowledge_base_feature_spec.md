# Functional Specification: Knowledge Base (RAG System)

**Author:** Researcher Aider
**Status:** Draft
**Version:** 1.0
**Date:** 2025-08-03
**Related Spec:** `docs/specs/pilot_v1_functional_spec.md`

## 1. Overview

This document provides a detailed functional specification for the Knowledge Base feature. This feature allows users to upload personal documents and interact with them through a Retrieval-Augmented Generation (RAG) chat interface, effectively creating a personal search engine for their own information.

## 2. User Journey & Functional Flow

### 2.1. Document Upload
1.  The user navigates to the `/documents` page.
2.  They click an "Upload Document" button, which opens a modal.
3.  The modal contains a drag-and-drop area and a traditional file selection button.
4.  **Supported File Types:** The initial version will support `.txt`, `.md`, and `.pdf`. The UI should clearly state this.
5.  Once files are selected, they appear in a list within the modal. Each file has a progress indicator showing the upload status.
6.  The user confirms the upload. The files are sent to a secure storage bucket.
7.  Upon successful upload, a server-side process is triggered to parse the document, extract its text, create embeddings, and store them in a vector database associated with the user's `family_id`.

### 2.2. Document Management
1.  The main view of the `/documents` page displays a list of all uploaded documents for the user's family.
2.  The list should be a table with columns for `Filename`, `Status` (`Processing`, `Completed`, `Error`), and `Upload Date`.
3.  Users can delete documents. Deleting a document should remove the file from storage and its corresponding vectors from the database.

### 2.3. Chat Interaction
1.  A chat interface is persistently available on the `/documents` page.
2.  The user types a question into the input box and submits it.
3.  The backend API receives the query, creates an embedding for it, and queries the vector database to find the most relevant document chunks (the "context").
4.  The query and the retrieved context are sent to an LLM with a prompt instructing it to answer the question based *only* on the provided sources.
5.  The AI's response is streamed back to the user in the chat interface.

## 3. Source Citation

A critical aspect of a trustworthy RAG system is source citation.

-   When the AI provides an answer, it must also cite the source document(s) it used.
-   The UI should display these sources clearly beneath the AI's response.
-   Example: "Source: `Family Handbook.pdf`, page 3".
-   Clicking on a source could ideally open a view of that document, highlighting the specific text chunk used for the answer.

## 4. Data & API Model

-   **`documents` table:** Will need columns for `id`, `user_id`, `family_id`, `filename`, `storage_path`, `status`, and `created_at`.
-   **Vector Database:** A separate table (e.g., `document_chunks`) will store the text chunks, their embeddings, and a foreign key back to the `documents.id`.
-   **API Endpoints:**
    -   `POST /api/documents/upload`: Handles file upload to storage and triggers the processing job.
    -   `POST /api/documents/chat`: Handles the RAG query flow.
    -   `GET /api/documents`: Lists all documents for the user.
    -   `DELETE /api/documents/[id]`: Deletes a document and its associated vectors.
