# Developer Experience
There is ongoing effort to provide a better developer experience and document it.

## How to develop locally with Docker
First install a recent version of [Docker](https://docs.docker.com/get-docker/), and [Docker Compose](https://docs.docker.com/compose/install/).

On the production host, copy its untracked `.env` file into this checkout once, then start dev:

```
Copy-Item C:\apps\sleepless\.env .env
docker compose -f docker-compose-dev.yaml up --build
```

The frontend dev server is available at http://localhost:8088 and Django directly at
http://localhost:8081. Log in with an existing account. Stop the stack with
`docker compose -f docker-compose-dev.yaml down` (do not add `-v` unless you intend to delete the
cached frontend dependencies).

> **Warning:** this dev app reads and writes the production PostgreSQL database and the same
> `M:\mediacms` media files. Test uploads, edits, and deletions affect production. Automatic
> migrations are disabled. The dev server and webpack port are bound to localhost only.

### What does docker-compose-dev.yaml do?
It builds the development backend image and starts a Node frontend dev server and Django. Django
connects to the existing PostgreSQL and Redis services on the external `server_default` network;
there are no local database or Redis containers. It uses the production database, the `M:\mediacms`
media mount, and Redis database `/2`, separate from production's `/1`. Automatic database migrations
and a dev Celery worker are not started. Async tasks queued by dev therefore do not run. The repository
is mounted into Django so Python changes are picked up by `runserver`. Frontend source is mounted into
the Node container; `node_modules` and npm's download cache live in Docker volumes rather than on Windows.

* Backend: `mediacms/mediacms-dev:latest` (built locally from the current checkout)
* Frontend: `node:24` running webpack-dev-server

PostgreSQL and Redis are existing services on `server_default`; this compose file does not create
development database, Redis, or Celery containers. Dev reads and writes the shared production
database and media files. Do not run schema migrations from this stack against the production
database. For development on another machine, provide private network/tunnel access to PostgreSQL and
Redis and mount the same media share; the local Docker network itself is not shared between machines.

For Django, the development setup differs from production in these ways:

* Django runs in debug mode, with `python manage.py runserver`
* gunicorn and nginx are not run
* Django runs in Debug mode, with Debug Toolbar
* Static files (js/css) are loaded from static/ folder
* corsheaders is installed and configured to allow all origins

For React, it runs `npm start` in the frontend folder, which starts webpack-dev-server on
http://localhost:8088/. It proxies pages and API requests to Django and serves JS/CSS bundles from
the live build, so frontend changes appear without rebuilding the production bundle. The Django
backend is also available directly at http://localhost:8081.

### How to develop in Django
Django starts at http://localhost:8081 and is reloading automatically. Making any change to the
Python code should refresh Django.

If Django breaks due to an error (eg SyntaxError, while editing the code), you might have to restart it

```
docker compose -f docker-compose-dev.yaml restart web
```



### How to develop in React
The dev server is on http://localhost:8088/ and the code is in `frontend/`, so changes are rebuilt
and the page reloads. Use http://localhost:8081 to test Django writes directly if the webpack proxy
has issues with POST/CORS. Django itself serves bundles from `static/`, so build and copy the
production frontend assets before committing frontend changes.

### Making changes to the frontend

The way React is added is more complicated than the usual SPA project and this is because React is used as a library loaded by Django Templates, so it is not a standalone project and is not handling routes etc.

The two directories to consider are:
* frontend/src , for the React files
* templates/, for the Django templates.

Django is using a highly intuitive hierarchical templating system (https://docs.djangoproject.com/en/4.2/ref/templates/), where the base template is templates/root.html and all other templates are extending it.

React is called through the Django templates, eg templates/cms/media.html is loading js/media.js

In order to make changes to React code, edit code on frontend/src and check its effect on http://localhost:8088/ . Once ready, build it and copy it to the Django static folder, so that it is served by Django.

Each page bundle has an entry file in frontend/src/entries/<name>.js, and templates/cms/<page>.html loads static/js/<name>.js together with static/js/_commons.js. Styles used by more than one page go to static/css/_commons.css; styles used by a single page go to static/css/<name>.css, which that page's template must link. The build is configured in frontend/webpack.config.js.

### Development workflow with the frontend
1. Edit frontend/src/ files
2. Check changes on http://localhost:8088/
3. Build frontend with `docker compose -f docker-compose-dev.yaml exec -T frontend npm run dist`
4. Copy all static files to Django's static folder in PowerShell:
   `Copy-Item -Path frontend\dist\static\* -Destination static\ -Recurse -Force`
5. Restart Django - `docker compose -f docker-compose-dev.yaml restart web` so that it uses the new static files
6. Commit the changes

### Helper commands
There is ongoing effort to provide helper commands, check the Makefile for what it supports. Eg

Bash into the web container:

```
user@user:~/mediacms$ make admin-shell
root@ca8c1096726b:/home/mediacms.io/mediacms# ./manage.py shell
```

Build the frontend:

```
user@user:~/mediacms$ make build-frontend
docker compose -f docker-compose-dev.yaml exec frontend npm run dist

> mediacms-frontend@0.9.2 dist
> webpack --mode=production
...
```
