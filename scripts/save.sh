#!/usr/bin/env bash
# commit data/ + docs/ if they changed and push (rebasing onto anything pushed meanwhile)
git config user.name "op.gg tracker"
git config user.email "actions@users.noreply.github.com"
git add data docs
if git diff --cached --quiet; then echo "nothing new"; exit 0; fi
git commit -q -m "New games $(date -u +%Y-%m-%dT%H:%MZ)"
for i in 1 2 3 4 5; do
  git push -q && exit 0
  git fetch -q origin main && git rebase -q -X theirs origin/main || { git rebase --abort; git pull -q --no-rebase -X ours origin main --no-edit; }
  sleep 3
done
exit 1
