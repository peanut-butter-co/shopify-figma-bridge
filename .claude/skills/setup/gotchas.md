# Setup Gotchas

Lessons learned from configuring the Shopify-to-Figma pipeline. Append a dated bullet
here whenever the user corrects the setup approach (see the skill's "After Completion" step).

- A password-protected store serves a password page first; the storefront is not reachable
  until the password is submitted. Capture it into `config.storePassword` (stored in
  plaintext in the git-ignored manifest) and re-enter it on the password page when navigating.
