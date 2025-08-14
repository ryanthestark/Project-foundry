# High-Fidelity Mockups: Pilot V1 Features

**Author:** Designer Aider
**Status:** In Progress
**Version:** 1.0
**Date:** 2025-08-03
**Reference Docs:**
- `docs/design/pilot_v1_mockups.md`
- `docs/design/visual_identity_and_polish_guide.md`
- `docs/specs/dormant_feature_specs.md`

## 1. Overview

This document provides detailed, high-fidelity mockups for the remaining "Pilot V1" features. These designs are implementation-ready and adhere strictly to the established visual identity.

---

## 2. The Private Journal (`/journal`)

A serene, focused, and rewarding space for personal reflection.

### 2.1. Main View: Today's Entry

This is the default view when navigating to `/journal`. It presents a clean interface for creating or editing the current day's entry.

-   **Layout:** A two-panel layout on desktop.
    -   **Left Panel:** A calendar for navigating past entries.
    -   **Right Panel:** The main editor for the selected day's entry. On mobile, the calendar collapses or is a separate view.
-   **Header:** "Journal" with a primary action button "View All Entries".
-   **Editor Panel Title:** Defaults to the current date, e.g., "August 3, 2025".

#### 2.1.1. Mood Tracker Component
-   **Placement:** At the top of the editor panel.
-   **Interaction:** A row of 5 emoji faces, from sad to happy. The selected emoji has a colored glow (using the accent gradient) and is slightly larger.
    -   `😔 😟 🙂 😊 😄`
-   **Label:** "How was your day?"

#### 2.1.2. Habit Tracker Component
-   **Placement:** Below the mood tracker.
-   **Interaction:** A row of small, labeled buttons for predefined habits (e.g., "Exercise", "Read", "Meditate").
-   **Style:** Unselected buttons are outlined (`secondary` style). Selected buttons are filled (`primary` style).
-   **Label:** "Did you stick to your habits?"

#### 2.1.3. Main Text Area
-   **Style:** A large, clean `Textarea` component with no border, allowing for distraction-free writing.
-   **Prompt:** A subtle, inspiring prompt is shown if the text area is empty, e.g., "What's on your mind today?"

#### 2.1.4. Save Action
-   A "Save Entry" button is located at the bottom of the panel. It shows a loading spinner during the save operation and a checkmark on success.

### 2.2. Browse View: Calendar

-   **Interaction:** Clicking a date on the calendar in the left panel loads that day's entry into the editor panel.
-   **Style:**
    -   Dates with entries are visually marked with a small dot.
    -   The currently selected date is highlighted with a circular background.
    -   The current day has a distinct border color.

---

## 3. The Knowledge Base (`/documents`)

A secure and intuitive interface for managing and interacting with personal documents.

### 3.1. Main View

-   **Header:** "Documents" with a primary action button "Upload Document".
-   **Layout:** A two-part view.
    -   **Top:** A prominent drag-and-drop zone for file uploads.
    -   **Bottom:** A list or table of all uploaded documents.

#### 3.1.1. Upload Interface
-   **Style:** A large, dashed-border area with an icon (`UploadCloud`) and text: "Drag & drop files here, or click to select files."
-   **Interaction:** Clicking opens the system file browser. Dropping files initiates the upload process.
-   **Progress:** While uploading, a progress bar appears for each file within this zone.

#### 3.1.2. Document List
-   **Style:** A table or list of `Card` components.
-   **Columns/Content:**
    -   **Name:** File icon and filename (e.g., `Family_Vacation_Itinerary.pdf`).
    -   **Status:** A colored `Badge` component: `Processing` (Yellow), `Ready` (Green), `Error` (Red).
    -   **Uploaded:** Date of upload.
    -   **Actions:** A `DropdownMenu` (`MoreHorizontal` icon) with options: "Chat", "Rename", "Delete". The "Chat" option is only enabled for `Ready` documents.

### 3.2. Chat Interface (`/documents/[docId]/chat`)

-   **Layout:** A standard chat interface.
-   **Header:** Clearly indicates which document is being chatted with: "Chat with `Family_Vacation_Itinerary.pdf`".
-   **Message Display:**
    -   User messages are right-aligned.
    -   AI responses are left-aligned.
-   **Source Citation:**
    -   When the AI provides an answer, it must cite its source from the document.
    -   **Implementation:** Below the AI's response, a "Sources" section appears with clickable references (e.g., "Page 3, Paragraph 2"). Clicking a source could highlight the relevant text in a document preview pane.

---

## 4. The Feedback Hub (`/feature-requests`)

A clean and simple forum for users to suggest and vote on new features.

### 4.1. Main View

-   **Header:** "Feature Requests" with a primary action button "Submit an Idea".
-   **Layout:** A two-column layout.
    -   **Left/Main:** A list of existing feature requests, sorted by "Most Votes" or "Most Recent".
    -   **Right:** The form for submitting a new request.

#### 4.1.1. Request Submission Form
-   **Style:** A `Card` component with a header "Have an idea?".
-   **Fields:**
    -   `Input` for "Title".
    -   `Textarea` for "Describe your idea...".
-   **Action:** A "Submit Request" button.

#### 4.1.2. Request List Item
-   **Style:** Each request is its own `Card`.
-   **Content:**
    -   **Upvote Control:** A vertical component on the left side of the card with an up-arrow icon, the vote count, and a down-arrow. The user's vote state is clearly indicated (e.g., a colored arrow).
    -   **Main Content:** The request title, a snippet of the description, the author's name, and the submission date.
    -   **Status Badge:** A `Badge` indicating the request's status (`Under Review`, `Planned`, `Completed`).
