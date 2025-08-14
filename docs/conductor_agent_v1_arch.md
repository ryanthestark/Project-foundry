# Conductor Agent Architecture V1

This document outlines the high-level architecture for the autonomous Conductor Agent, a system designed to automate our development workflow.

## 1. The Planner

The Planner is responsible for taking a high-level goal and breaking it down into a detailed project plan, consisting of discrete tasks with defined dependencies.

### Data Models (Supabase)

The following tables will be used to store project plans in our Supabase database.

#### `projects`

Stores high-level project information.

| Column Name     | Data Type                | Description                                      | Constraints              |
|-----------------|--------------------------|--------------------------------------------------|--------------------------|
| `id`            | `uuid`                   | Primary key.                                     | `DEFAULT uuid_generate_v4()` |
| `created_at`    | `timestamp with time zone` | Timestamp of creation.                           | `DEFAULT now()`          |
| `name`          | `text`                   | The name of the project.                         | `NOT NULL`               |
| `goal`          | `text`                   | The high-level goal or mission for the project.  | `NOT NULL`               |
| `status`        | `text`                   | Current status of the project (e.g., `pending`, `in_progress`, `completed`, `failed`). | `DEFAULT 'pending'`      |

#### `project_tasks`

Stores individual tasks that are part of a project.

| Column Name     | Data Type                | Description                                      | Constraints              |
|-----------------|--------------------------|--------------------------------------------------|--------------------------|
| `id`            | `uuid`                   | Primary key.                                     | `DEFAULT uuid_generate_v4()` |
| `created_at`    | `timestamp with time zone` | Timestamp of creation.                           | `DEFAULT now()`          |
| `project_id`    | `uuid`                   | Foreign key to the `projects` table.             | `REFERENCES projects(id)` |
| `description`   | `text`                   | A detailed description of the task.              | `NOT NULL`               |
| `status`        | `text`                   | Current status of the task (e.g., `pending`, `ready`, `in_progress`, `completed`, `failed`, `blocked`). | `DEFAULT 'pending'`      |
| `assigned_to`   | `text`                   | The Aider agent assigned to this task (e.g., `EngineerAider`, `ArchitectAider`). | |
| `output`        | `text`                   | The output or result of the task upon completion. | |

#### `task_dependencies`

Defines the dependency graph between tasks. A task cannot start until all its prerequisite tasks are completed.

| Column Name           | Data Type | Description                                      | Constraints                               |
|-----------------------|-----------|--------------------------------------------------|-------------------------------------------|
| `task_id`             | `uuid`    | The task that has a dependency.                  | `REFERENCES project_tasks(id)`, `PRIMARY KEY` |
| `depends_on_task_id`  | `uuid`    | The task that must be completed first.           | `REFERENCES project_tasks(id)`, `PRIMARY KEY` |

### API Design

The primary endpoint for the Planner will be used to initiate the planning process.

#### `POST /api/conductor/plan`

This endpoint accepts a high-level goal and uses an AI model (e.g., a specialized LLM) to generate a project plan, populating the `projects`, `project_tasks`, and `task_dependencies` tables.

**Request Body:**

```json
{
  "name": "Implement User Authentication",
  "goal": "Add a complete email/password and social login (Google) authentication system to the application."
}
```

**Response Body (Success - 202 Accepted):**

The planning process is asynchronous. The API will immediately return a response with the new project's ID and a status endpoint to poll for completion.

```json
{
  "projectId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "statusUrl": "/api/conductor/plan/a1b2c3d4-e5f6-7890-1234-567890abcdef/status"
}
```

## 2. The Watcher

The Watcher is the orchestrator. It monitors the state of tasks and triggers new tasks as their dependencies are met.

### System Design

The Watcher will operate as a persistent background process. Its primary mechanism for monitoring will be a combination of:

1.  **Database Polling:** Periodically query the `project_tasks` table to check for tasks with `status = 'completed'`. This is simple to implement and robust.
2.  **GitHub Webhooks:** For tasks that involve code changes, a GitHub App will be used to send webhooks to a dedicated endpoint (e.g., `/api/conductor/webhook/github`). This provides real-time updates on pull request merges, which can signify task completion.

### Logic Flow

1.  **Identify Completed Tasks:** The Watcher scans for tasks that have recently transitioned to `completed`.
2.  **Find Dependent Tasks:** For each completed task, it queries the `task_dependencies` table to find all tasks that depend on it (`depends_on_task_id`).
3.  **Check Dependencies:** For each dependent task found, it checks if all *other* prerequisite tasks are also `completed`.
4.  **Trigger Next Task:** If all dependencies for a task are met, the Watcher updates the task's `status` from `pending` or `blocked` to `ready`.
5.  **Dispatch to Prompter:** The Watcher then passes the `ready` task to the Prompter to initiate execution.

## 3. The Prompter

The Prompter is responsible for generating a precise, context-rich prompt for the assigned Aider to execute a specific task.

### System Design

The Prompter is a service that is triggered by the Watcher when a task becomes `ready`.

1.  **Retrieve Task Details:** It fetches the full details of the `ready` task from the `project_tasks` table.
2.  **Gather Context:**
    *   **Project Goal:** It retrieves the overall project goal from the `projects` table.
    *   **File System State:** It scans the current Git repository to get a list of relevant files. This can be scoped by using a tool like `ctags` or a simple file tree summary.
    *   **Dependency Outputs:** It gathers the `output` from all prerequisite tasks (from `task_dependencies` and `project_tasks`) to provide context from completed work.
3.  **Generate Prompt:** It combines the project goal, specific task description, dependency outputs, and file context into a detailed prompt. The prompt is tailored to the `assigned_to` Aider role.
4.  **Invoke Aider:** The Prompter invokes the target Aider with the generated prompt. The mechanism for this could be a direct function call if in a monolithic architecture, or an API call if Aiders are separate services.

### Data Flow

```
[Watcher] -- TaskID --> [Prompter]
           |
           +-> [DB] Fetches Task(TaskID), Project(Task.ProjectID)
           |
           +-> [Git Repo] Scans file structure
           |
           +-> [DB] Fetches outputs of prerequisite tasks
           |
           +-> [LLM] Generates context-rich prompt
           |
           +-> [Target Aider API] Sends prompt for execution
```
