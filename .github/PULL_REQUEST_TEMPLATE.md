<!--
Thanks for contributing! Keep the diff focused and describe the change plainly.
-->

## What & why

<!-- What does this PR change, and why? Link any related issue (#123). -->

## How was it verified?

<!-- The command(s) you ran and what you saw. "Exported the stack and `docker
compose up` brought both containers up healthy" beats "should work". -->

## Checklist

- [ ] Commits are signed off (`git commit --signoff` — DCO, see [CONTRIBUTING.md](../CONTRIBUTING.md))
- [ ] `npm run type-check` passes (0 errors)
- [ ] `npm run lint` passes (0 errors; warnings tolerated)
- [ ] Relevant tests pass (`npm run test:unit`, plus integration/e2e if touched)
- [ ] New non-trivial logic has a test
- [ ] No secrets, `.env` files, or generated artifacts committed
