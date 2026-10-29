#!/usr/bin/env bash
# Real worker SMTP proof, reusable before and after a disposable recovery.
set -euo pipefail
set +x
[[ ${CI:-} = true ]] || { echo 'Worker smoke requires an isolated CI runner.' >&2; exit 1; }
: "${SWI_CONFIG_DIR:?Disposable configuration required}"
: "${SWI_PROJECT_NAME:?Disposable project required}"
case "$SWI_PROJECT_NAME" in swi-smoke-*) ;; *) echo 'Refusing a non-smoke project.' >&2; exit 1 ;; esac
root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
work=$(mktemp -d)
cleanup() {
  local status=$?
  docker rm -f "$SWI_PROJECT_NAME-mailpit" >/dev/null 2>&1 || true
  rm -rf -- "$work"
  exit "$status"
}
trap cleanup EXIT
umask 077
mkdir -p "$SWI_CONFIG_DIR/tls/mailpit"
chmod 700 "$SWI_CONFIG_DIR/tls/mailpit"
openssl req -newkey rsa:2048 -nodes -keyout "$SWI_CONFIG_DIR/tls/mailpit/key.pem" \
  -out "$SWI_CONFIG_DIR/tls/mailpit/request.csr" -subj /CN=mailpit >/dev/null 2>&1
printf 'subjectAltName=DNS:mailpit\nextendedKeyUsage=serverAuth\n' > "$work/mailpit.ext"
openssl x509 -req -in "$SWI_CONFIG_DIR/tls/mailpit/request.csr" \
  -CA "$SWI_CONFIG_DIR/tls/ca.crt" -CAkey "$SWI_CONFIG_DIR/tls/ca.key" -CAcreateserial \
  -out "$SWI_CONFIG_DIR/tls/mailpit/cert.pem" -days 1 -extfile "$work/mailpit.ext" >/dev/null 2>&1
network=$(docker inspect "$(sh scripts/vps-compose.sh ps -q app)" \
  --format '{{range $name, $settings := .NetworkSettings.Networks}}{{println $name}}{{end}}' | sed -n '/_edge$/p' | head -n 1)
[[ -n "$network" ]] || { echo 'Disposable edge network was not found.' >&2; exit 1; }
docker run -d --name "$SWI_PROJECT_NAME-mailpit" --user 0:0 \
  --network "$network" --network-alias mailpit \
  -v "$SWI_CONFIG_DIR/tls/mailpit:/tls:ro" axllent/mailpit:v1.27 \
  --smtp-auth-accept-any --smtp-require-starttls --smtp-tls-cert /tls/cert.pem --smtp-tls-key /tls/key.pem
sh scripts/vps-compose.sh run --rm --no-deps -T -e SWI_RECOVERY_SMOKE=1 ops node docker/vps/jobs-smoke.mjs
