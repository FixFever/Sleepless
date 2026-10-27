# AGENTS.md

Working notes for coding agents in this repository.

## What this project is

Sleepless is a self-hosted video/media portal built on MediaCMS. It is a heavily customized fork:
Django 5.2 + Django REST Framework + Celery + PostgreSQL + Redis on the backend, React on the frontend,
with local apps for RBAC, SAML/SSO, LTI, identity providers and a media migration service
(Kaltura / YouTube / Panopto import).

- Python dependencies: `requirements.txt`; dev/test extras: `requirements-dev.txt`.
- Frontend: Node 20, package manifest in `frontend/package.json`.
- Version lives in `package.json` and `cms/version.py`; releases are automated (see Commits).

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
- Development flow: edit `frontend/src` → check on `:8088` → build and publish with
  `make build-frontend` (`npm run dist`, copy `frontend/dist/static/*` into `static/`, restart `web`) →
  commit the regenerated `static/` bundle together with the source.
- Never hand-edit generated bundles in `static/`; change the source and rebuild.

## Commits and releases

- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `test:`, `chore:`), with an
  optional scope: e.g. `fix: correct HLS label for portrait video`.
- Releases are computed by semantic-release on `main` from commit messages. Do not hand-edit `CHANGELOG.md`,
  `package.json` version or release notes.
- Keep commits focused; avoid committing `media_files/` uploads, `local_settings.py`, `node_modules/`,
  `static_collected/` or `.env` files.

## Gotchas

- `.github/` is gitignored in this fork, so there are no CI workflows or PR templates in the repo.
- `README.md` is intentionally minimal; real documentation lives in `docs/` (`dev_exp.md`,
  `developers_docs.md`, `media_permissions.md`, migration guides).
- `templates/` and `static/` are committed products; a change to frontend code is incomplete until the
  bundle is rebuilt and copied.
- Code comments and commit messages are English; user-facing portal strings are Russian (`PORTAL_NAME`,
  `PORTAL_DESCRIPTION`, translations under `files/frontend_translations/`).
- The fork tracks upstream MediaCMS (`2248b7e Merge remote-tracking branch 'upstream/main'`). Preserve
  upstream structure where possible to keep merges cheap, and prefer additive changes in new modules.
