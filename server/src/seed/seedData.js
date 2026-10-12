// Sample data for local development. Everything here is fake and public: never use it in production.

// Shared by every seed user. It meets the app's rules (at least 8 characters) and is documented in the README.
export const SEED_PASSWORD = 'DevPassword123!';

// The reserved ".test" domain can never belong to a real person, so these can't clash with real accounts.
export const SEED_USERS = [
  { key: 'alex', name: 'Alex Morgan', email: 'alex@taskflow.test' },
  { key: 'priya', name: 'Priya Patel', email: 'priya@taskflow.test' },
  { key: 'jordan', name: 'Jordan Lee', email: 'jordan@taskflow.test' },
  { key: 'sam', name: 'Sam Rivera', email: 'sam@taskflow.test' },
];

/**
 * Each task:
 *  - key: a stable name. The task's database id is derived from it, which is how re-running the seed finds it.
 *  - creator / assignee: user keys (assignee null = unassigned).
 *  - due: days from today (negative = overdue), or null.
 *  - created: how many days ago it was created.
 *  - path: the statuses it went through BEFORE its current one. Every step (including the final move into
 *    `status`) becomes one status-history row, made by the creator or the assignee.
 */
export const SEED_TASKS = [
  // --- Idea ---
  { key: 'dark-mode', title: 'Explore dark mode for the dashboard', description: 'Check which colour tokens need dark variants and sketch a toggle in the navbar.', status: 'Idea', priority: 'Low', creator: 'alex', assignee: null, labels: ['design', 'ui'], due: null, created: 12, path: [] },
  { key: 'slack-hook', title: 'Slack notifications for assigned tasks', description: 'Send a Slack message when someone is assigned a task. Needs a decision on webhooks vs. a bot.', status: 'Idea', priority: 'Medium', creator: 'priya', assignee: 'alex', labels: ['integration'], due: null, created: 9, path: [] },
  { key: 'csv-export', title: 'Export tasks to CSV', description: 'Let people download the current filtered list as a CSV file.', status: 'Idea', priority: 'Low', creator: 'jordan', assignee: null, labels: ['feature'], due: null, created: 7, path: [] },
  { key: 'mobile-app', title: 'Investigate a mobile app wrapper', description: 'Is a PWA enough, or do we need a native shell? Write up pros and cons.', status: 'Idea', priority: 'Medium', creator: 'sam', assignee: 'priya', labels: ['research', 'mobile'], due: 20, created: 5, path: [] },

  // --- To Do ---
  { key: 'password-reset', title: 'Add password reset by email', description: 'Users who forget their password currently have no way back in. Send a single-use, expiring reset link.', status: 'To Do', priority: 'High', creator: 'alex', assignee: 'priya', labels: ['auth', 'backend'], due: 6, created: 10, path: ['Idea'] },
  { key: 'a11y-audit', title: 'Run an accessibility audit on the task list', description: 'Check keyboard navigation, focus order and colour contrast with an automated tool and a screen reader.', status: 'To Do', priority: 'Medium', creator: 'priya', assignee: 'jordan', labels: ['accessibility', 'ui'], due: 14, created: 8, path: [] },
  { key: 'seed-docs', title: 'Document the local setup steps', description: 'Write a short guide covering Docker, environment variables and running the tests.', status: 'To Do', priority: 'Low', creator: 'jordan', assignee: null, labels: ['docs'], due: null, created: 6, path: [] },
  { key: 'rate-limit', title: 'Tighten rate limits on login', description: 'Review the limits on /api/auth/login and add a short lockout after repeated failures.', status: 'To Do', priority: 'Critical', creator: 'sam', assignee: 'sam', labels: ['security', 'backend'], due: -2, created: 11, path: [] },

  // --- In Progress ---
  { key: 'task-filters', title: 'Add due-date filter to the task list', description: 'Filter by overdue, due this week and no due date. Must work together with the existing status and priority filters.', status: 'In Progress', priority: 'High', creator: 'alex', assignee: 'alex', labels: ['frontend', 'feature'], due: 3, created: 14, path: ['To Do'] },
  { key: 'board-perf', title: 'Speed up the Kanban board on large projects', description: 'The board feels slow with a few hundred tasks. Profile rendering and avoid re-rendering untouched columns.', status: 'In Progress', priority: 'Medium', creator: 'priya', assignee: 'priya', labels: ['performance', 'frontend'], due: 9, created: 13, path: ['Idea', 'To Do'] },
  { key: 'email-templates', title: 'Design the welcome email', description: 'Plain-text and HTML versions that match the TaskFlow branding.', status: 'In Progress', priority: 'Low', creator: 'jordan', assignee: 'alex', labels: ['design', 'email'], due: -1, created: 10, path: ['To Do'] },
  { key: 'api-errors', title: 'Make API error messages consistent', description: 'Every error should use the { error: { message } } shape. Audit the controllers and fix the stragglers.', status: 'In Progress', priority: 'High', creator: 'sam', assignee: 'jordan', labels: ['backend', 'tech-debt'], due: 5, created: 9, path: ['To Do'] },

  // --- In Review ---
  { key: 'attachments-ui', title: 'Polish the attachments section', description: 'Show upload progress, file icons and clearer error messages for unsupported files.', status: 'In Review', priority: 'Medium', creator: 'alex', assignee: 'priya', labels: ['frontend', 'attachments'], due: 2, created: 16, path: ['To Do', 'In Progress'] },
  { key: 'indexes', title: 'Review database indexes for task queries', description: 'Confirm the list and stats queries use the indexes. Attach explain() output to the pull request.', status: 'In Review', priority: 'High', creator: 'priya', assignee: 'sam', labels: ['database', 'performance'], due: 1, created: 15, path: ['To Do', 'In Progress'] },
  { key: 'onboarding-copy', title: 'Rewrite the empty-state copy', description: 'Friendlier text and a clear first action for new users with no tasks yet.', status: 'In Review', priority: 'Low', creator: 'jordan', assignee: 'jordan', labels: ['copy', 'ui'], due: null, created: 8, path: ['In Progress'] },
  { key: 'ci-cache', title: 'Cache dependencies in CI', description: 'Cut the pipeline time by caching npm installs for the client and server.', status: 'In Review', priority: 'Medium', creator: 'sam', assignee: null, labels: ['devops'], due: 7, created: 12, path: ['To Do', 'In Progress'] },

  // --- Completed ---
  { key: 'login-page', title: 'Build the login and registration pages', description: 'Forms with validation, loading and error states, and session restore on refresh.', status: 'Completed', priority: 'High', creator: 'alex', assignee: 'alex', labels: ['auth', 'frontend'], due: -10, created: 30, path: ['To Do', 'In Progress', 'In Review'] },
  { key: 'task-crud', title: 'Create the task CRUD API', description: 'Create, read, update and delete with validation and per-user visibility rules.', status: 'Completed', priority: 'Critical', creator: 'priya', assignee: 'priya', labels: ['backend', 'api'], due: -14, created: 28, path: ['To Do', 'In Progress', 'In Review'] },
  { key: 'docker-setup', title: 'Set up Docker for local development', description: 'One command should start MongoDB, the API and the client with hot reload.', status: 'Completed', priority: 'Medium', creator: 'jordan', assignee: 'sam', labels: ['devops'], due: -20, created: 35, path: ['To Do', 'In Progress'] },
  { key: 'status-history', title: 'Show status history on the task page', description: 'A timeline of who moved the task between statuses and when.', status: 'Completed', priority: 'Medium', creator: 'sam', assignee: 'jordan', labels: ['feature', 'frontend'], due: -5, created: 20, path: ['Idea', 'To Do', 'In Progress', 'In Review'] },
];
