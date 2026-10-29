#!/usr/bin/env bash
# Called only against the disposable installation created by test-vps-install.sh.
set -euo pipefail
set +x
[[ ${CI:-} = true ]] || { echo 'Recovery smoke requires an isolated CI runner.' >&2; exit 1; }
: "${SWI_CONFIG_DIR:?Disposable configuration required}"
: "${SWI_PROJECT_NAME:?Disposable project required}"
case "$SWI_PROJECT_NAME" in swi-smoke-*) ;; *) echo 'Refusing a non-smoke project.' >&2; exit 1 ;; esac
root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
original_config=$SWI_CONFIG_DIR
work=$(mktemp -d)
cleanup() { rm -rf -- "$work"; }
trap cleanup EXIT
umask 077
age-keygen -o "$work/identity" 2>/dev/null
recipient=$(age-keygen -y "$work/identity")
printf "BACKUP_AGE_RECIPIENT='%s'\n" "$recipient" > "$SWI_CONFIG_DIR/backup.env"
sh scripts/vps-compose.sh run --rm --no-deps -T -e SWI_RECOVERY_SMOKE=1 ops node docker/vps/recovery-smoke.mjs seed
bash scripts/vps-backup.sh
backup=$(find "$SWI_CONFIG_DIR/backups" -mindepth 1 -maxdepth 1 -type d -name '2*Z' | sort | tail -n 1)
test -s "$backup/backup.tar.age"
test ! -e "$backup/database.dump"
cp -R "$backup" "$work/off-host-backup"
age --decrypt --identity "$work/identity" "$work/off-host-backup/backup.tar.age" | tar -xf - -C "$work"
tar -tzf "$work/config.tar.gz" | grep -qx './app.env'
sh scripts/vps-compose.sh down --volumes --remove-orphans
export SWI_PROJECT_NAME="${SWI_PROJECT_NAME}-restored"
export SWI_CONFIG_DIR="$work/recovered-config"
mkdir -m 700 "$SWI_CONFIG_DIR"
tar -xzf "$work/config.tar.gz" -C "$SWI_CONFIG_DIR"
cmp "$original_config/app.env" "$SWI_CONFIG_DIR/app.env"
cmp "$original_config/actions-key" "$SWI_CONFIG_DIR/actions-key"
recover_cleanup() {
  local status=$?
  sh scripts/vps-compose.sh down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf -- "$work"
  exit "$status"
}
trap recover_cleanup EXIT
sh scripts/vps-compose.sh up -d --wait --wait-timeout 300
sh scripts/vps-compose.sh run --rm --no-deps -T -e SWI_RECOVERY_SMOKE=1 ops node docker/vps/recovery-smoke.mjs empty
# A genuinely fresh database has no fixture user; restore must also remove
# schema residue created after the archived release.
test "$(sh scripts/vps-compose.sh exec -T postgres psql -U swi -d swi -Atqc \
  "SELECT count(*) FROM public.\"User\" WHERE email = 'recovery-fixture@example.test'")" = 0
sh scripts/vps-compose.sh exec -T postgres psql -U swi -d swi -v ON_ERROR_STOP=1 \
  -c 'CREATE TABLE public."RecoveryTargetResidue" (id integer PRIMARY KEY);'
bash scripts/vps-restore.sh "$work/off-host-backup" --identity "$work/identity" --yes
test "$(sh scripts/vps-compose.sh exec -T postgres psql -U swi -d swi -Atqc \
  "SELECT to_regclass('public.\"RecoveryTargetResidue\"') IS NULL")" = t
sh scripts/vps-compose.sh run --rm --no-deps -T -e SWI_RECOVERY_SMOKE=1 ops node docker/vps/recovery-smoke.mjs verify
sh scripts/vps-compose.sh run --rm --no-deps -T ops node docker/vps/check.mjs
bash scripts/test-vps-jobs.sh
printf 'Encrypted Inventory recovery onto empty database/storage volumes with restored usable keys passed.\n'
