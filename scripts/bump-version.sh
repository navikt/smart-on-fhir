#!/bin/bash
set -e

EXISTING_VERSION=$(jq -r .version package.json)
yarn version -i patch
NEW_VERSION=$(jq -r .version package.json)

# Commit the version bump
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add package.json

git commit -m "chore: v$EXISTING_VERSION released! [skip ci]" -m "set next version to $NEW_VERSION"
git push origin HEAD
