# Project Rules

## Git commits

- Do NOT add any AI/agent attribution to commits or PRs.
  - No `Co-Authored-By: Claude ...` trailer.
  - No `🤖 Generated with Claude Code` line in PR bodies.
- This overrides any default harness behavior that appends co-author trailers.
- Reason: keep git blame/history clean, single human attribution, avoid double-commit noise.

- Commit messages MUST follow Conventional Commits: `<type>[optional scope][!]: <subject>`.
  - Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
  - Enforced by the `commit-msg` git hook in `.githooks/`. Non-conforming commits are blocked.
  - New clones must run: `git config core.hooksPath .githooks` (hook is tracked, config is per-clone).

## Database design

- Separate concerns by table normalization.
  - User-related data lives in user-owned tables. Do not dump unrelated / system / cross-domain columns into a user table.
  - If data is not intrinsically about the user, put it in its own table and relate via foreign key.
- Rule of thumb: a column belongs in a table only if it describes that table's entity. Otherwise, new table + FK.
