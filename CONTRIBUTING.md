 # Contributing to Tessera.io

First off, thank you for considering contributing to Tessera.io! It's people like you that make this tool such a great collaborative sandbox.

## Reporting Issues

Before opening a new issue, please search the existing issues to see if the problem or feature request has already been discussed.

If you find a new bug or have a feature proposal, please open an issue using our interactive templates:

* **🐛 Bug Reports:** Choose this template to report crashes, unexpected behavior, or security issues. Please include reproduction steps, expected behavior, and system environment info.
* **💡 Feature Requests:** Choose this template to suggest new features, integrations, or improvements to the collaborative developer sandbox.

---

## How to Contribute

### 1. Claim an Issue

* Find an open issue you'd like to work on. We recommend checking out our good first issues.
* Comment `/claim` directly on the issue. Our auto-claim bot will automatically verify that the issue is unassigned, assign it to you, and post a welcoming confirmation comment.

### 2. Star & Fork the Repository

* **Star the repo:** Show your support by starring the main Tessera.io repository.
* **Fork it:** Click the "Fork" button at the top right of the repository page to create your own copy.

**Clone your fork:**

```bash
git clone git@github.com:<your-username>/Tessera.io.git
cd Tessera.io
```

### 3. Branching

Create a new branch for your feature or bug fix:

```bash
git checkout -b feature/your-feature-name
```

### 4. Making Changes

Make your changes in the relevant workspace(s) as described in the `README.md`.

Please ensure that:

* Your code follows the project's TypeScript guidelines.
* Code remains clean, readable, and maintainable.
* Existing functionality is not broken.
* New functionality is adequately tested.

Test your changes locally by running:

```bash
npm run typecheck
npm run build
npm run dev
```

### 5. Committing Your Changes

Commit your changes using clear and descriptive commit messages.

Example:

```bash
git commit -m "feat: add collaborative workspace improvements"
```

We encourage contributors to follow conventional commit formats when possible:

```text
feat: add new feature
fix: resolve authentication issue
docs: update contributing guide
refactor: improve code structure
```

### 6. Submit a Pull Request

Once you've pushed your commits to your fork, head over to the main repository and open a Pull Request.

Please ensure your Pull Request includes:

* A clear description of the problem being solved.
* A summary of the changes made.
* Any relevant issue references.
* Testing details, if applicable.

#### UI Changes

If your Pull Request includes UI-related changes, please include one of the following:

* At least one screenshot showing the updated user interface, or
* A short GIF/video demonstrating the change and relevant interactions.

Providing visual evidence helps reviewers understand, verify, and test UI improvements more efficiently.

---

## Adding a New Language

To add support for a new language in Tessera.io, follow these steps:

### 1. Shared Types
Add the new language to `SupportedLanguage` in `packages/shared-types/`.

### 2. Execution Sandbox
Add a new Docker sandbox container for the language in `apps/execution-engine/`.

### 3. Monaco Editor Mapping
Map the language to its Monaco editor identifier in `apps/web/src/App.tsx`.

### 4. IntelliSense (Optional)
Add an IntelliSense completion provider in `apps/web/src/` following the existing provider patterns in the codebase.

---

## Frequently Asked Questions

1. How do I start contributing to Tessera.io?
    - Find an open issue.
    - Comment /claim on the issue.
    - Wait for the auto-claim bot or the maintainer to assign the issue to you.
    - Fork the repository and create a new branch.
    - Implement your changes and submit a Pull Request.

2. Do I need to be assigned before working on an issue?
    Yes. Contributors should claim issues using the /claim command and wait for assignment confirmation from the auto-claim bot before starting work.

3. What should I do if I encounter merge conflicts?
    Update your branch with the latest changes from the target branch, resolve conflicts locally, test your changes again, and push the updated branch.

4. How long does Pull Request review take?
    Review times depend on maintainer availability and project activity. Please be patient and avoid repeatedly requesting reviews.

5. How do I know if my issue claim was successful?
    The auto-claim bot will assign the issue to you and post a confirmation comment. If you do not receive confirmation, verify that the issue is still available.

6. Can I submit a Pull Request without an issue?
    For significant changes, it is recommended to claim or create an issue first. Small documentation improvements or minor fixes may be discussed directly through a Pull Request.

7. Can I work on multiple issues at the same time?

    The maximum number of issues a contributor can claim at the same time is 3, contributors are encouraged to complete existing work before claiming additional issues.

---

## Need Help?

Look for issues tagged with `good first issue` if you're not sure where to start.

We look forward to your contributions and thank you for helping improve Tessera.io!