# Functional Specification: Feature Requests

**Author:** Researcher Aider
**Status:** Draft
**Version:** 1.0
**Date:** 2025-08-03
**Related Spec:** `docs/specs/pilot_v1_functional_spec.md`

## 1. Overview

This document provides a detailed functional specification for the Feature Requests hub. This feature allows users to submit ideas for improving the application and vote on suggestions from other users, creating a transparent and community-driven feedback loop.

## 2. User Journey

### 2.1. Viewing Feature Requests
1.  The user navigates to the `/feature-requests` page.
2.  A list of existing feature requests is displayed, sorted by `vote_count` in descending order by default.
3.  The user can change the sort order to "Most Recent" (`created_at`).
4.  Each request in the list displays its title, a snippet of the description, the current vote count, and the request's status (e.g., `Under Review`, `Planned`, `Shipped`).

### 2.2. Submitting a New Request
1.  The user clicks a "Suggest a Feature" button.
2.  A modal or separate page appears with a simple form.
3.  The form contains two fields: `title` (a short summary) and `description` (a more detailed explanation). Both are required.
4.  Upon submission, the new request is added to the `feature_requests` table and appears in the main list (typically at the bottom, with 1 initial vote from the submitter).

### 2.3. Upvoting a Request
1.  Each feature request card in the list has an "Upvote" button next to the vote count.
2.  If the user has not yet voted for this request, the button is in its default state.
3.  Clicking the "Upvote" button performs two actions:
    a. It increments the `vote_count` on the `feature_requests` table.
    b. It creates a record in a `feature_request_votes` table to link the `user_id` and `request_id`, preventing duplicate votes.
4.  The UI immediately updates to show the new vote count and changes the button to a "voted" state (e.g., filled with color, different icon) to provide clear feedback.
5.  Clicking the button again could potentially remove the user's vote (decrementing the count and deleting the record), though this is an optional V2 feature.

## 3. Data Model

### 3.1. `feature_requests` Table
| Column Name   | Data Type     | Constraints                              | Description                               |
|---------------|---------------|------------------------------------------|-------------------------------------------|
| `id`          | `uuid`        | Primary Key, default `gen_random_uuid()` | Unique identifier for the request.        |
| `user_id`     | `uuid`        | Foreign Key to `auth.users.id`, Not Null | The user who submitted the request.       |
| `title`       | `text`        | Not Null                                 | The title of the feature request.         |
| `description` | `text`        | Not Null                                 | The detailed description.                 |
| `vote_count`  | `integer`     | Not Null, default `1`                    | The total number of upvotes.              |
| `status`      | `text`        | Not Null, default `'Under Review'`       | The current status of the request.        |
| `created_at`  | `timestamptz` | Default `now()`                          | Timestamp of creation.                    |

### 3.2. `feature_request_votes` Table
| Column Name   | Data Type     | Constraints                              | Description                               |
|---------------|---------------|------------------------------------------|-------------------------------------------|
| `request_id`  | `uuid`        | Foreign Key to `feature_requests.id`     | The request being voted on.               |
| `user_id`     | `uuid`        | Foreign Key to `auth.users.id`           | The user who voted.                       |

**Constraint:** A composite primary key on `(request_id, user_id)` will enforce the one-vote-per-user rule.
