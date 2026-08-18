# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Writing text students read

**Read [`docs/brand-world.md`](docs/brand-world.md) first.** It holds the product's argument,
the beliefs the build actually acts on, the words we use and the words we never use and why,
what motion is allowed to mean, and what we can and cannot claim to a buyer right now. Check
it before writing a headline, a button label, an empty state, or a new prompt. The rules
below are the mechanical half; that doc is the half that decides whether the sentence is one
we would say.

Every word a student can see goes through the `humanizer` skill before it lands: headings,
body copy, button labels, form hints, placeholders, empty states, error messages, dropdown
options, and the AI prompts. Prompts count because the register a prompt is written in is
the register the model answers in, and that output goes into cold emails students send to
real professionals.

**No em dashes and no en dashes anywhere in text.** Use a period, comma, colon, or brackets.
A hyphen between numbers in a range is fine. Code comments are exempt; nothing rendered is.

Grepping `src/` for them is useless, because it returns hundreds of hits that are almost all
comments. Check the built bundle, where comments are already stripped:

```bash
npx vite build >/dev/null 2>&1 && grep -o '[—–]' dist/assets/*.js | wc -l
```

**2 is correct.** Both live inside `PLAIN_PROSE_RULES` in `src/lib/llm.js`, which is the rule
that bans them. Anything above 2 is text someone added.

`npm run lint` now catches them at source too, in strings, template literals and JSX text,
including ones written as unicode escapes, which a text search misses entirely. That rule is
the fast check; the bundle count above is still the one that decides. Note the lint script
already exits non-zero for unrelated pre-existing errors, so read the rule names rather than
the exit code.

`PLAIN_PROSE_RULES` is the house style for generated prose and is already appended to every
prompt that writes something a person reads. **A new prompt must append it too.** That is the
step most likely to be missed.

Curly apostrophes and quotes are deliberate and stay. They are correct typography and read as
nothing on a rendered page, so do not "fix" them to straight quotes.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `docs/brand-world.md`: the house voice, vocabulary and point of view. Read before writing any text a student or buyer sees, or any new prompt.
- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.
