#!/usr/bin/env bash
set -euo pipefail

root_dir="$(git rev-parse --show-toplevel)"
remote_url="$(git -C "$root_dir" remote get-url origin)"
source_revision="$(git -C "$root_dir" rev-parse --short HEAD)"
deploy_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$deploy_dir"
}
trap cleanup EXIT

cd "$root_dir"
npm run build

git clone --quiet --branch gh-pages --single-branch "$remote_url" "$deploy_dir"
rsync -a --delete --exclude .git dist/ "$deploy_dir/"

git -C "$deploy_dir" add -A
if git -C "$deploy_dir" diff --cached --quiet; then
  echo "Pages is already up to date."
  exit 0
fi

git -C "$deploy_dir" commit -m "Deploy ${source_revision}"
git -C "$deploy_dir" push origin gh-pages
