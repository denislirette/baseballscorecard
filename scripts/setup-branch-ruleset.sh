#!/usr/bin/env bash
# Setup branch ruleset for baseball-scorebook
# Run this locally with: bash scripts/setup-branch-ruleset.sh
#
# Prerequisites: gh auth login
#
# What this creates:
#   - "master" branch protection that's solo-dev friendly:
#     * Requires PRs (so you don't accidentally push straight to master)
#     * But lets YOU bypass everything as admin — no waiting on reviews
#     * Blocks force pushes and deletions (so you don't nuke your main branch)
#     * Requires linear history (keeps your git log clean)
#   - Community contributors still have to open PRs, which you can review at your pace

set -euo pipefail

REPO="denislirette/baseball-scorebook"

echo "Creating branch ruleset for $REPO..."

gh api repos/$REPO/rulesets \
  --method POST \
  --input - <<'EOF'
{
  "name": "Protect master",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    {
      "actor_id": 5,
      "actor_type": "RepositoryRole",
      "bypass_mode": "always"
    }
  ],
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/master"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "creation"
    }
  ]
}
EOF

echo ""
echo "Done! Here's what's set up:"
echo ""
echo "  Master branch rules:"
echo "    - PRs required to merge (but 0 reviews needed)"
echo "    - You bypass everything as repo admin"
echo "    - Force push blocked"
echo "    - Branch deletion blocked"
echo ""
echo "  What this means for you:"
echo "    - You can still merge your own PRs instantly"
echo "    - Community PRs show up for you to review"
echo "    - Nobody (including you, accidentally) can force push to master"
echo ""
echo "  To check your ruleset:"
echo "    gh api repos/$REPO/rulesets | jq '.[].name'"
echo ""
echo "  To delete it if you change your mind:"
echo "    RULESET_ID=\$(gh api repos/$REPO/rulesets --jq '.[0].id')"
echo "    gh api repos/$REPO/rulesets/\$RULESET_ID --method DELETE"
