# syntax=docker/dockerfile:1.7
#
# FuelRats client Kiwi IRC (clients.fuelrats.com): upstream kiwiirc pinned to one commit, with the
# FuelRats rescue module (overlay/src/plugins/fuelrats) compiled into the bundle, served by an
# unprivileged nginx on :8080. Node is a build-time tool only (22 LTS: vue-cli 5's node-ipc caps
# engines at 22); the runtime image is nginx + static files. The test stage (eslint, stylelint,
# jest) gates the build stage.
#
# KIWI_VARIANT picks what is compiled in and baked as static/config.json:
#   rescue (default)  clients.fuelrats.com: patches-web/rescue/ bundles the rescue module;
#                     config/config.json.
#   rat               kiwi.fuelrats.com: patches-web/rat/ bundles the rat module
#                     (overlay/src/plugins/fuelrats-rat) instead; config/config.rat.json.
# patches-web/common/ applies to both. Lint and unit tests cover the overlay of both variants.
#
# overlay/package.json + overlay/yarn.lock replace upstream's: upstream's package.json plus yarn
# "resolutions" that lift vulnerable transitive deps (lodash, ip-address, postcss, nanoid, ...)
# and i18next-http-backend 4.x. When KIWIIRC_COMMIT moves, re-apply those edits to the new
# upstream package.json and regenerate yarn.lock (yarn install in node:22-alpine).
#
#   docker build -f modern/Dockerfile -t fr-kiwi-web modern/
#   docker build -f modern/Dockerfile --build-arg KIWI_VARIANT=rat -t fr-kiwi-web-rat modern/
#   docker build -f modern/Dockerfile --target test modern/     # lint + unit tests only

ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30-alpine

FROM ${NODE_IMAGE} AS source
ARG KIWIIRC_COMMIT=7345960f0da2dc014d464aa0e2c41fe6390314b6
ADD --checksum=sha256:31df4dff06941f1ea2e59fa6eb0a08f05d2441b752aa9a86ca80be8f0a70e9bc \
    https://github.com/kiwiirc/kiwiirc/archive/${KIWIIRC_COMMIT}.tar.gz /tmp/kiwiirc.tar.gz
RUN mkdir /src && tar -xzf /tmp/kiwiirc.tar.gz -C /src --strip-components=1

FROM ${NODE_IMAGE} AS deps
WORKDIR /src
COPY overlay/package.json overlay/yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile --non-interactive --network-timeout 600000

FROM deps AS overlay
ARG KIWIIRC_COMMIT=7345960f0da2dc014d464aa0e2c41fe6390314b6
ARG KIWI_VARIANT=rescue
RUN case "$KIWI_VARIANT" in rescue|rat) ;; *) echo "bad KIWI_VARIANT" >&2; exit 1;; esac
RUN apk add --no-cache git
COPY --from=source /src/ ./
COPY patches-web/ /tmp/patches/
RUN set -e; for p in /tmp/patches/common/*.patch "/tmp/patches/${KIWI_VARIANT}"/*.patch; do \
        [ -e "$p" ] || continue; \
        git apply -p1 "$p"; \
    done
COPY overlay/ ./
COPY tests/unit/ ./tests/unit/
COPY config/ /tmp/config/
RUN if [ "$KIWI_VARIANT" = rat ]; then cfg=config.rat.json; else cfg=config.json; fi && \
    cp "/tmp/config/$cfg" ./static/config.json
# vue.config.js reads the commit via git; the tarball has no .git, so give it one to report.
RUN git init -q && git -c user.name=build -c user.email=build@localhost commit -q --allow-empty \
        -m "kiwiirc ${KIWIIRC_COMMIT} + fuelrats overlay"

FROM overlay AS test
RUN yarn lint && yarn test:unit --coverage=false && touch /tmp/tests-passed

FROM overlay AS build
COPY --from=test /tmp/tests-passed /tmp/tests-passed
RUN yarn build --nomap

FROM ${NGINX_IMAGE} AS web
ARG KIWI_VARIANT=rescue
# Label text per variant: KIWI_IS_RAT is "rat" only for rat, KIWI_IS_RESCUE "rescue" only for rescue.
ARG KIWI_IS_RAT=${KIWI_VARIANT#rescue}
ARG KIWI_IS_RESCUE=${KIWI_VARIANT#rat}
LABEL org.opencontainers.image.title="fr-kiwi-web${KIWI_IS_RAT:+-rat}" \
      org.opencontainers.image.description="${KIWI_IS_RESCUE:+FuelRats rescue-client Kiwi IRC (static SPA + nginx)}${KIWI_IS_RAT:+FuelRats rat Kiwi IRC (static SPA + nginx)}" \
      org.opencontainers.image.source="https://github.com/FuelRats/Kiwi-RescuePlugin"
USER root
RUN apk upgrade --no-cache
USER nginx
# host:port of the webircgateway container, resolved per request through Docker's DNS.
ENV KIWI_GATEWAY=kiwi-gateway:7001 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist/ /usr/share/nginx/html/
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
