# AGENTS.md — Mobunaga standalone repository

## Scope
This repository is the standalone source of truth for Mobunaga (`https://nobunaga.mobs.tokyo`).

## Production / deploy
- Production working tree: `/var/www/uzero.style/nobunaga`
- GitHub repository: `Taiju-h/mobunaga`
- Branch: `main`
- Public URL: `https://nobunaga.mobs.tokyo`
- Deployment is pull-only from this repository via the UZERO deployer target `mobunaga`.
- The parent `Taiju-h/uzero-style` repository is only the deployer/control repository. Do not put Mobunaga application changes back into it.
- Do not claim production is updated from a GitHub commit alone; production requires the server deploy action/pull.

## Secrets
- Never commit credentials, tokens, passwords, or production INI files.
- Admin config: `/var/www/.nobunaga-admin.ini`
- DB config: `/var/www/.nobunaga-db.ini`
- Analysis-room passphrase hash belongs in `/var/www/.nobunaga-admin.ini`, not PHP source.
- Example config files may contain placeholders such as `CHANGE_ME` only.

## Data / season rules
- Public data lives primarily in `assets/database.json`, `assets/formations.json`, and related generated JSON.
- MySQL database name: `nobunaga`.
- Season is a first-class dimension. Never leak later-season generals, tactics, formations, comments, or recommendations to earlier-season viewers.
- S4 content may be added when explicitly supported by source material. Keep source-derived facts distinct from inference.
- Tactic calculations use Lv10 values by default.

## Images
- General portraits live under `assets/portraits/`.
- Reuse those portraits across general detail, formations, archive, and templates.
- `assets/details` is a compatibility symlink to `assets/portraits` on production/repository; do not create an independent duplicate detail-image tree.
- Never add a detail-image mapping to a file that is not deployable.

## UX / implementation
- Preserve the existing mobile-first roster/catalog behavior and visual language.
- Bump static cache/version query strings when changing long-lived JS/CSS assets.
- For new standalone feature pages, keep navigation back to the main site and preserve season/spoiler context where relevant.
- New public S4 special pages may be static HTML when the content is editorial/reference material rather than catalog data.

## Safety checks before commit
- Confirm `git rev-parse --show-toplevel` is `/var/www/uzero.style/nobunaga` on production.
- Check for staged secret-like files (`.env`, real `.ini`, `.pem`, `.key`) before push.
- Check actual file/path existence before writing deployment instructions.
- Do not use the parent UZERO repository for Mobunaga changes.

## Editorial TIPS
- Place Mobunaga's original commentary and calculations in the trailing TIPS panel, with its distinct color and face icon.
- Visualize numerical comparisons, turn-by-turn changes, and resource balances with labeled charts/bars; do not rely on number-heavy prose alone.
- Distinguish observed values, assumed calculation examples, damage rates, and actual damage. Do not invent missing measurements.
- Use site-owned wording such as 実測; avoid 提供動画 and other wording that treats the site owner's work as an external contribution.

- The main/sidebar season selection includes earlier content (entry season <= viewer season). Search/catalog season filters remain exact-match. Do not conflate these two controls; switching the main season resets search filters. Preserve original season labels.

## Public battle-report privacy
- Before publishing any battle-report screenshot, permanently remove player names and clan names from the image pixels, including images opened at full size. Apply this to every new batch, including S4 land reports.
- Preserve generals, tactics, levels, troop counts, and battle results exactly. Verify all images before committing, and change image cache versions when redacting an existing asset.
