// flawless-react-website — build the Astro site and publish it to the static plane.
//
// Caddy serves flawless-react.in.drlario.org from /srv/sites/flawless-react-website/current.
// `current` is a symlink site-deploy swaps atomically and Caddy resolves per request, so a
// deploy needs no reload — unlike a Caddyfile change, which does (that file is a single-file
// bind mount, so an edit changes the inode and the container keeps reading the old copy).
pipeline {
    agent any
    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }
    environment {
        // flawless-react is private and LAN-only, so the canonical host is the internal
        // vhost. This is the ONLY consumer of Astro.site (src/layouts/Layout.astro does
        // `new URL(Astro.url.pathname, Astro.site)`), and an undefined value throws — so the
        // build fails loudly rather than emitting wrong canonical tags.
        SITE_URL = 'https://flawless-react.in.drlario.org'
        SITE     = 'flawless-react-website'
    }
    stages {
        stage('Preflight') {
            steps {
                sh '''
                    set -eu
                    test -w /srv/sites || { echo "/srv/sites not writable"; exit 1; }
                    test -x /opt/publish/bin/site-deploy || { echo "site-deploy not mounted"; exit 1; }
                    test -f bun.lock || { echo "no bun.lock"; exit 1; }
                    # bun.lock is the only lockfile here, deliberately. crust-website carried a
                    # second one for a while and the two silently pinned different astro
                    # versions; this fails rather than repeating that.
                    test ! -f package-lock.json || {
                        echo "package-lock.json present — bun.lock is the source of truth here"; exit 1; }
                    echo "astro: $(grep -oE '\"astro@[0-9][^\"]*\"' bun.lock | head -1)"
                '''
            }
        }
        stage('Build') {
            steps {
                sh '''
                    set -eu
                    rm -rf dist

                    # No -v "$PWD:/w". The workspace lives in the jenkins_home NAMED VOLUME, so
                    # that host path does not exist as the daemon resolves it. docker cp goes
                    # through the client and therefore does see it.
                    CID=$(docker create -w /w -e SITE_URL="$SITE_URL" oven/bun:1 \
                            sh -c 'set -eu; cd /w; bun install --frozen-lockfile; bun run build')
                    trap 'docker rm -f "$CID" >/dev/null 2>&1 || true' EXIT

                    docker cp "$PWD/." "$CID:/w" >/dev/null
                    docker start -a "$CID"
                    docker cp "$CID:/w/dist/." "$WORKSPACE/dist/"

                    test -s dist/index.html || { echo "no index.html in dist"; exit 1; }
                    test -s dist/404.html   || { echo "no 404.html — Caddy's handle_errors block would be inert"; exit 1; }
                    echo "built $(find dist -name '*.html' | wc -l) page(s)"
                '''
            }
        }
        stage('Gate') {
            steps {
                sh '''
                    set -eu
                    # flawless-react is not public. A build that leaks a repository URL into the
                    # served HTML is a defect, so fail on it here rather than in a browser.
                    if grep -rlE 'github\\.com|larioborges-timbuk2' dist; then
                        echo "FAIL: public references found in built output (see files above)"
                        exit 1
                    fi
                    grep -q 'rel="canonical" href="https://flawless-react.in.drlario.org/"' dist/index.html \
                        || { echo "FAIL: canonical URL is not the LAN host"; exit 1; }
                    echo "gate passed: no public references, canonical is correct"
                '''
            }
        }
        stage('Deploy') {
            steps {
                sh '''
                    set -eu
                    VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' package.json | head -1)+$(git rev-parse --short HEAD).${BUILD_NUMBER}"
                    /opt/publish/bin/site-deploy "$SITE" "$WORKSPACE/dist" "$VERSION"
                '''
            }
        }
        stage('Verify') {
            steps {
                sh '''
                    set -eu
                    # Assert against the live URL, not against what we just wrote to disk.
                    code=$(curl -sS -o /dev/null -w '%{http_code}' -m 30 "$SITE_URL/")
                    echo "$SITE_URL/ -> $code"
                    [ "$code" = 200 ] || exit 1

                    nf=$(curl -sS -o /dev/null -w '%{http_code}' -m 30 "$SITE_URL/definitely-not-a-page")
                    echo "missing path -> $nf"
                    [ "$nf" = 404 ] || exit 1

                    curl -sS -m 30 "$SITE_URL/" | grep -q 'apps.in.drlario.org/install.sh' \
                        || { echo "FAIL: the LAN install one-liner is not on the page"; exit 1; }
                '''
            }
        }
    }
}
