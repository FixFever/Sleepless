# Frontend feature and publishing workflow

## During feature work

- Edit source files in `frontend/src/`, `frontend-tools/`, and templates as needed.
- Preview the live React bundle at `http://localhost:8088`. The dev server rebuilds and reloads when
  source changes; production bundles in `static/` are not needed for this preview.
- Do not build/copy production assets or increment `cms/version.py` until the user explicitly says
  **"можно публиковать"** (or otherwise approves publication).

## After publication approval

Build only the frontend packages whose sources changed:

### Main React frontend (`frontend/src/`)

With the dev stack running:

```powershell
docker compose -f docker-compose-dev.yaml exec -T frontend npm run dist
Copy-Item -Path frontend\dist\static\* -Destination static\ -Recurse -Force
```

This copies the complete generated bundle set, including `_commons` assets, into the tracked
`static/` tree. Do not hand-edit generated files there.

### Standalone frontend tools

Run these only when the corresponding package source changed; their build scripts write directly to
their tracked output directories under `static/`.

```powershell
Push-Location frontend-tools/video-editor
corepack yarn@1.22.22 install --frozen-lockfile
corepack yarn@1.22.22 build:django
Pop-Location

Push-Location frontend-tools/chapters-editor
corepack yarn@1.22.22 install --frozen-lockfile
corepack yarn@1.22.22 build:django
Pop-Location

Push-Location frontend-tools/video-js
npm ci
npm run build:django
Pop-Location
```

Outputs are `static/video_editor/`, `static/chapters_editor/`, and `static/video_js/` respectively.
If both a standalone tool and `frontend/src/` changed, run both relevant builds.

### Final checks and handoff

1. Increment the fourth component in `cms/version.py` once for the production deployment, to bust
   browser caches for static assets.
2. Run applicable frontend tests (`docker compose -f docker-compose-dev.yaml exec -T frontend npm
   test -- --ci`) and inspect `git diff`/`git status`.
3. Ensure generated `static/` changes are included. Do not include `node_modules/`, `dist/`, `.env`,
   or media data.
4. Report what was built and any checks that could not run. Do not commit or push; the user reviews
   the diff and pushes it. Pushing to `main` triggers the GHCR image build and production deployment.

Changes only to Django/Python or templates do not require a frontend asset build. The production
Docker image is built by GitHub Actions after the user pushes.

`deploy/scripts/build_and_deploy.sh` is a legacy script: it uses the old dev compose file and restarts
a service. Do not use it for this approval-gated workflow.
