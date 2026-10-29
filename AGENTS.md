# AGENTS.md

Working notes for coding agents in this repository.

## What this project is

Sleepless is a self-hosted video/media portal built on MediaCMS. It is a heavily customized fork:
Django 5.2 + Django REST Framework + Celery + PostgreSQL + Redis on the backend, React on the frontend,
with local apps for RBAC, SAML/SSO, LTI, identity providers and a media migration service
(Kaltura / YouTube / Panopto import).

- Python dependencies: `requirements.txt`; dev/test extras: `requirements-dev.txt`.
- Frontend: Node 20, package manifest in `frontend/package.json`.
- `package.json` keeps the upstream SemVer version. `cms/version.py` supplies the runtime version used
  in rendered pages and static-asset cache-busting URLs. This fork has no automated release/versioning
  job; GitHub Actions builds and deploys the production image from `main`. Local deployments use a
  four-part version such as `9.1.2.1` (upstream version + fork revision).

## Repository map

| Path | Purpose |
| --- | --- |
| `cms/` | Django settings (`settings.py`), URLs, Celery app, `dev_settings.py`, `test_settings.py` |
| `files/` | Core app: media, categories, playlists, comments, encoding, subtitles. Models and views are split by domain |
| `users/`, `actions/` | Users/channels, likes/dislikes/views actions |
| `rbac/`, `identity_providers/`, `saml_auth/`, `lti/` | Access control, SSO, LTI integrations |
| `migrationservice/` | Admin-only import service with provider registry and Celery orchestration |
| `uploader/` | Fine Uploader endpoints |
| `frontend/src/` | React/TypeScript sources, built into `static/` |
| `frontend/config/` | Webpack page registry (`mediacms.config.pages.js`) and build config |
| `templates/` | Django templates; `templates/root.html` is the base everyone extends |
| `static/` | Committed build output (JS/CSS/images) served by Django/nginx |
| `tests/` | Central pytest suite; some apps also keep `tests.py` |
| `fixtures/`, `media_files/` | JSON fixtures (categories, encode profiles) and media assets |
| `docs/` | Human docs; `docs/superpowers/{specs,plans}/` hold design docs and implementation plans |
| `deploy/`, `docker-compose*.yaml`, `Dockerfile` | Deployment and image build |

Design/plan documents under `docs/superpowers/` state constraints that implementations are expected to
follow. Read the relevant plan before changing a feature it covers.

## Local development

```sh
docker compose -f docker-compose-dev.yaml up       # Django on :80 (admin/admin), React on :8088
make admin-shell                                   # bash inside the web container
docker compose -f docker-compose-dev.yaml restart web   # after a hard Django crash
```

Django auto-releases changed Python code. The React dev server hot-reloads but cannot handle POST
requests and has partial CORS support, so verify writes against the main app on port 80.

### This fork's deployment

- The active installation uses the root `docker-compose.yaml` (`mediacms`, exposed on `:5454`), not
  `docker-compose-dev.yaml`. Production runs the GHCR image `ghcr.io/fixfever/sleepless`; it does not
  bind-mount the repository. Do not use dev-compose targets for production deployment.
- `.github/workflows/deploy.yml` builds the Dockerfile `base` target, publishes both the commit SHA and
  `main` tags, then pulls the exact commit image on the Windows host at `C:\apps\sleepless`. The `base`
  target excludes Whisper/PyTorch; use the `full` target only if Whisper transcription is intentionally
  enabled. Old GHCR package versions are cleaned up after deployment, retaining the 10 newest versions.
- Production data remains outside the image: media is bind-mounted from `M:\mediacms`, and logs use
  the external Docker volume `mediacms_logs`. Preserve both when updating or recreating services; the
  external `server_default` network must also exist.
- Runtime settings come from the deployment `.env` and the tracked
  `deploy/docker/local_settings.py` included in the image. The entrypoint copies the latter to
  `cms/local_settings.py`; do not add a host bind mount for the repository or generated settings file.
- Private GHCR pulls require a `read:packages` login configured for the same Windows account used by
  the SSH deployment. Docker Desktop's credential helper may fail in non-interactive SSH sessions;
  keep the deployment account's Docker CLI credentials usable without that helper.
- The deployment workflow pulls the image and runs `docker compose up -d --no-build`; do not build the
  production image on the Windows host. Continue incrementing the fourth `cms/version.py` component
  when frontend asset URLs need cache invalidation.

## Tests

```sh
make test                                    # pytest -n auto in the web container with TESTING=True
make test-coverage

# single test / module
docker compose -f docker-compose-dev.yaml exec --env TESTING=True -T web \
  pytest tests/api/test_api_media_list.py::MediaListVisibilityTest::test_anonymous_sees_only_listable_media

# frontend
docker compose -f docker-compose-dev.yaml exec -T frontend npm test
```

- `TESTING=True` switches to `cms/test_settings.py`: Celery runs eagerly, cache is in-memory,
  `MEDIA_ROOT` is a temp directory, and password hashing is fast. Tests that rely on background
  workers must not assume real Celery/Redis.
- Backend tests are `django.test.TestCase` classes run by pytest-django. Reusable constructors live in
  `files/tests/media_utils.py` and `files/tests/user_utils.py` (exported via `files/tests/__init__.py`).
- `conftest.py` blocks DNS resolution for anything other than the DB/Redis hosts. Mock external calls
  (`requests`, provider clients, yt-dlp) instead of hitting the network.
- Tests must be deterministic and offline; do not add tests that depend on wall-clock timing or remote files.

## Lint and formatting

```sh
pre-commit install
pre-commit run --all-files
```

- Python: `black` (line length 200, string normalization off), `isort --profile black`, `flake8`
  (`E501`, `E203` ignored). Run `flake8` on the files you touch.
- JS/TS: Prettier from `.prettierrc` (single quotes, 4 spaces, width 120, LF). Match the surrounding file:
  both `.tsx` and `.js` pages exist.

## Backend conventions

- Models are grouped by domain in `files/models/<topic>.py` and re-exported from `files/models/__init__.py`.
  Views follow the same pattern in `files/views/`, re-exported from `files/views/__init__.py`. Keep the
  re-exports in sync — other modules import from the package, not the submodule.
- APIs are DRF `APIView`/viewsets exposed under `/api/v1/...`, routed in `<app>/urls.py`, and documented
  with `drf_yasg`'s `swagger_auto_schema`. Interactive docs: `/swagger/`.
- Permission logic belongs in `cms/permissions.py` or the app's `permissions.py`; shared media visibility
  and query helpers live in `files/methods.py`.
- Async work belongs in the app's `tasks.py` as Celery tasks. Keep tasks idempotent — the same media can
  be queued more than once.
- Migrations: generate with `python manage.py makemigrations <app>`. Never hand-write, squash or rewrite
  existing migrations, and never edit applied migrations to fix a schema issue.
- Settings go in `cms/settings.py`; per-installation overrides go in `cms/local_settings.py` (gitignored,
  imported at the end of `settings.py`). When registering an app, middleware or backend, update **both**
  `cms/settings.py` and `cms/dev_settings.py` — the dev compose file replaces `INSTALLED_APPS` wholesale.
- Do not hardcode secrets, hostnames or admin credentials; existing values in `settings.py` are deployment
  defaults for this installation, not a pattern to copy into new code.

## Frontend conventions

React is used as a library embedded in Django templates, not as a standalone SPA.

- Page components live in `frontend/src/static/js/pages/`; shared components and helpers are in
  `frontend/src/static/js/components/` and `.../utils/`.
- Every page must be registered in `frontend/config/mediacms.config.pages.js` (dev sample data comes from
  `frontend/.env`), and usually needs a Django template under `templates/` that loads its bundle.
- Data comes from the API helpers in `frontend/src/static/js/utils/settings/`, configured through
  `frontend/src/templates/config/`.
- Build flow: edit `frontend/src`, run `npm run dist` from `frontend/`, then copy **all** of
  `frontend/dist/static/*` into `static/` and commit the generated output with the source. The
  `make build-frontend` target uses `docker-compose-dev.yaml`; it is not suitable for this fork's
  deployment unless that dev frontend service is intentionally configured and running. Copying only a
  page bundle can leave it incompatible with `_commons.js`.
- In the dev compose setup, a local `npm install` creates `frontend/node_modules/` inside the
  bind-mounted tree. If dependencies were installed only to build, remove build-only `node_modules/`
  and `dist/` after copying the output. Production uses the built image, not this source mount.
- Never hand-edit generated bundles in `static/`; change the source and rebuild.

## Commits and releases

- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `test:`, `chore:`), with an
  optional scope: e.g. `fix: correct HLS label for portrait video`.
- The checked-in `.releaserc.json` is inherited upstream configuration; this fork has no CI/release job,
  so commits do not automatically publish releases or update versions. Do not assume semantic-release runs.
- Templates append `cms.version.VERSION` as `?v=...` to CSS/JS URLs. For each fork deployment, increment
  the fourth component (for example, `9.1.2.1` → `9.1.2.2`) to invalidate browser caches; when rebasing onto
  a newer upstream version, update the first three components and start the fork revision at `.1`.
  `package.json` remains a three-part SemVer version and does not control these URLs. Do not hand-edit
  `CHANGELOG.md` or release notes unless explicitly preparing a manual release.
- Keep commits focused; avoid committing `media_files/` uploads, `local_settings.py`, `node_modules/`,
  `static_collected/` or `.env` files.

## Gotchas

- `.github/` is mostly gitignored in this fork; `.github/workflows/deploy.yml` is explicitly unignored
  and tracked. There are no checked-in PR templates or automated release/versioning job.
- `README.md` is intentionally minimal; real documentation lives in `docs/` (`dev_exp.md`,
  `developers_docs.md`, `media_permissions.md`, migration guides).
- `templates/` and `static/` are committed products; a change to frontend code is incomplete until the
  bundle is rebuilt and copied.
- Code comments and commit messages are English; user-facing portal strings are Russian (`PORTAL_NAME`,
  `PORTAL_DESCRIPTION`, translations under `files/frontend_translations/`).
- The fork tracks upstream MediaCMS (`2248b7e Merge remote-tracking branch 'upstream/main'`). Preserve
  upstream structure where possible to keep merges cheap, and prefer additive changes in new modules.
