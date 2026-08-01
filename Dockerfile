# Local development image.
#
# It deliberately contains no application source and no dependencies: the repo
# is bind-mounted at run time and `pnpm install` runs inside the container into
# a named volume. What this image pins is the toolchain — the Node and pnpm
# versions — which is the part that actually differs between machines.
#
# Not Alpine. `workerd`, the runtime behind `wrangler dev` and the test pool,
# ships glibc binaries and does not run on musl.
FROM node:22.18.0-bookworm-slim

# Wrangler shells out to git for some operations, and curl is here for the
# health checks in the local QA scripts. Nothing else belongs in a dev image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

# The pnpm version comes from the "packageManager" field in package.json, so
# there is exactly one place that decides it for both the container and the
# native flow. Pre-fetching here keeps the first `docker compose up` from
# downloading pnpm before it can do anything useful.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

# The three node_modules directories are named volumes (see docker-compose.yml)
# so they don't collide with the host's own installs. Docker seeds a new named
# volume from whatever already exists at that path in the image — owned by
# root, since no USER has been set yet — so without this, the first `pnpm
# install` inside the container hits EACCES trying to create
# node_modules/.pnpm as the unprivileged user below.
RUN mkdir -p node_modules frontend/node_modules backend/node_modules backend/.wrangler \
    && chown -R node:node /app

# The base image already provides an unprivileged "node" user (uid 1000).
# Running as root would write root-owned files into the bind-mounted repo,
# which the developer then cannot edit without sudo.
USER node

EXPOSE 4321 8787

CMD ["pnpm", "run", "dev:container"]
