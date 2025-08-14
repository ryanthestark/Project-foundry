# Functional Specification: Private Journal

**Author:** Researcher Aider
**Status:** Draft
**Version:** 1.0
**Date:** 2025-08-03
**Related Spec:** `docs/specs/pilot_v1_functional_spec.md`

## 1. Overview

This document provides a detailed functional specification for the Private Journal feature. The goal is to offer users a secure, private, and encouraging space for daily reflection, habit tracking, and mood logging.

## 2. User Journey

### 2.1. Creating a New Entry
1.  The user navigates to the `/journal` page.
2.  The page defaults to the current day's entry form.
3.  If an entry for the day does not exist, the form is empty. If an entry exists, the form is pre-populated with that day's data.
4.  The user fills out the fields: `mood`, `habits`, `big_three` priorities, and the main `journal_text`.
5.  A "Save" button persists the entry to the database. The save action should be an upsert operation based on the `(user_id, entry_date)` composite key.
6.  Upon successful save, a subtle confirmation is shown (e.g., a "Saved!" toast notification).

### 2.2. Viewing and Editing Past Entries
1.  On the `/journal` page, a calendar component is displayed.
2.  Days with existing entries are visually marked on the calendar.
3.  The user can click on any past date in the calendar.
4.  Upon clicking a date, the main entry form is populated with the data for that selected date.
5.  The user can edit the content and re-save it.

## 3. Data Model

The feature will rely on a new `journal_entries` table in the database.

| Column Name  | Data Type      | Constraints                               | Description                                      |
|--------------|----------------|-------------------------------------------|--------------------------------------------------|
| `id`         | `uuid`         | Primary Key, default `gen_random_uuid()`  | Unique identifier for the entry.                 |
| `user_id`    | `uuid`         | Foreign Key to `auth.users.id`, Not Null  | The user who created the entry.                  |
| `entry_date` | `date`         | Not Null                                  | The specific date for the journal entry.         |
| `mood`       | `text`         | Nullable                                  | A simple string representing mood (e.g., "happy"). |
| `habits`     | `jsonb`        | Nullable                                  | A JSON object for tracking habits (e.g., `{"exercise": true, "read": false}`). |
| `big_three`  | `text[]`       | Nullable                                  | An array of up to three text strings for daily priorities. |
| `journal_text`| `text`         | Nullable                                  | The main free-text content of the journal entry. |
| `created_at` | `timestamptz`  | Default `now()`                           | Timestamp of creation.                           |
| `updated_at` | `timestamptz`  | Default `now()`                           | Timestamp of the last update.                    |

**Constraint:** A unique constraint should be placed on `(user_id, entry_date)` to ensure only one entry per user per day.

## 4. Unique Functionality

### 4.1. Daily Prompts
-   To encourage writing, the journal entry form can display an optional, dismissible daily prompt.
-   Prompts can be fetched from a simple static list or a dedicated `journal_prompts` table.
-   Example prompts: "What is one thing you're grateful for today?", "What challenge did you overcome this week?".

### 4.2. Calendar View
-   A simple calendar component will be the primary navigation for past entries.
-   API calls should fetch a list of dates that have entries for the currently displayed month to visually mark them.
-   This prevents fetching all journal entry data at once, optimizing performance.
