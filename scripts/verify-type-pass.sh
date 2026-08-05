#!/usr/bin/env bash
# Whole-app checks for the type pass. Run from the integration worktree root.
# Exits non-zero on any failure so it can gate the merge.
set -uo pipefail
fail=0
say() { printf '%-52s %s\n' "$1" "$2"; }
check() { if [ "$2" -eq 0 ]; then say "$1" "ok"; else say "$1" "FAIL ($2)"; fail=1; fi; }

echo "=== source ==="

# The floor.
#
# Six exemptions, each deliberate and each argued somewhere in the tree:
#   admin console + pilot   its own dense 13px system, outside this pass
#   ResumePreview           the printed document, not app chrome; the PDF and
#                           Word exporters read that node
#   components/ui           vendored primitives, blast radius beyond this pass
#   CampusMonthGrid         a 74px day square cannot carry 13px; see the note
#                           in that file, it was measured and reverted
#   components/landing      the reference standard this pass is reaching for,
#                           deliberately untouched so it cannot regress
#   LegalPage               its one hit is before:text-[11px] on the field
#                           labels the stacked mobile table draws from
#                           data-label: bold, uppercase, tracked out. That is
#                           tp-eyebrow, the one thing the scale allows under
#                           13px, and a pseudo-element cannot take a class.
BELOW=$(grep -rE 'text-xs\b|text-\[([0-9]|1[012])px\]|text-\[0\.[0-6][0-9]*rem\]' src \
  --include='*.jsx' --include='*.js' \
  | grep -v '^src/pages/admin/' \
  | grep -v '^src/components/admin/' \
  | grep -v '^src/pages/PilotDashboard.jsx' \
  | grep -v '^src/pages/AdminCampusFeeds.jsx' \
  | grep -v '^src/pages/AdminAiFailures.jsx' \
  | grep -v '^src/components/resume/ResumePreview.jsx' \
  | grep -v '^src/components/ui/' \
  | grep -v '^src/components/pilot/' \
  | grep -v '^src/components/campus/CampusMonthGrid.jsx' \
  | grep -v '^src/components/landing/' \
  | grep -v '^src/components/legal/LegalPage.jsx' \
  | wc -l | tr -d ' ')
check "no text below the 13px floor" "$BELOW"
[ "$BELOW" -gt 0 ] && grep -rE 'text-xs\b|text-\[([0-9]|1[012])px\]' src --include='*.jsx' \
  | grep -v '/admin/' | grep -v 'PilotDashboard\|AdminCampusFeeds\|AdminAiFailures\|ResumePreview' \
  | grep -v '/ui/\|/pilot/\|/landing/\|CampusMonthGrid\|LegalPage' | cut -d: -f1 | sort | uniq -c | sort -rn | head -10

# Layering: a tp- class next to the class it supersedes.
LAYERED=$(grep -rE 'tp-(page|section|card|lead|body|prose|meta|eyebrow)[^"'"'"']*\b(text-(xs|sm|base|lg|xl|[2-9]xl)|leading-[0-9])' src --include='*.jsx' | wc -l | tr -d ' ')
check "no tp- class layered over what it replaces" "$LAYERED"
[ "$LAYERED" -gt 0 ] && grep -rE 'tp-(page|section|card|lead|body|prose|meta|eyebrow)[^"'"'"']*\b(text-(xs|sm|base|lg|xl|[2-9]xl)|leading-[0-9])' src --include='*.jsx' | head -8

# Old page wrappers left behind.
#
# Exempt, and each one argued in the file itself: the landing page and the admin
# console are outside this pass; the guest intake and its review screen are one
# question per screen, where 960px reads worse than 672px; and /answer is a
# single card centred in the viewport for someone arriving from an email, the
# same shape as the auth and generation screens.
WRAP=$(grep -rE 'mx-auto max-w-(xl|2xl|3xl|4xl|5xl|6xl|7xl)' src/pages --include='*.jsx' \
  | grep -v '^src/pages/admin/' | grep -v 'Landing\|PilotDashboard\|AdminCampusFeeds\|AdminAiFailures' \
  | grep -v 'Onboarding' | grep -v 'AnswerNudge' | wc -l | tr -d ' ')
check "every page uses the one column" "$WRAP"
[ "$WRAP" -gt 0 ] && grep -rE 'mx-auto max-w-(xl|2xl|3xl|4xl|5xl|6xl|7xl)' src/pages --include='*.jsx' \
  | grep -v '/admin/' | grep -v 'Landing\|PilotDashboard\|AdminCampusFeeds' | cut -d: -f1 | sort -u | head

# Fonts are ours now, not a third party's flaky stylesheet endpoint.
REMOTE=$(grep -cE "@import url\\('https://api\\.fontshare\\.com" src/index.css 2>/dev/null | tr -d ' ')
check "no remote fontshare stylesheet import" "${REMOTE:-0}"
FONTS=$(ls public/fonts/*.woff2 2>/dev/null | wc -l | tr -d ' ')
if [ "$FONTS" -eq 8 ]; then say "8 self-hosted font files" "ok"; else say "8 self-hosted font files" "FAIL (found $FONTS)"; fail=1; fi

echo
echo "=== build ==="
if npx vite build >/tmp/tp-build.log 2>&1; then say "vite build" "ok"; else say "vite build" "FAIL"; tail -20 /tmp/tp-build.log; fail=1; fi

# The house rule. Comments are stripped from the bundle, so every hit here is
# text a student can actually read. 2 is correct: both live inside the rule
# that bans them, in lib/llm.js.
DASH=$(grep -o '[—–]' dist/assets/*.js 2>/dev/null | wc -l | tr -d ' ')
if [ "$DASH" -le 2 ]; then say "em/en dashes in the bundle (want <=2)" "ok ($DASH)"; else say "em/en dashes in the bundle (want <=2)" "FAIL ($DASH)"; fail=1; fi

# The scale and the local fonts actually made it into the shipped CSS.
INCSS=$(grep -o 'tp-page\|/fonts/' dist/assets/*.css 2>/dev/null | wc -l | tr -d ' ')
if [ "$INCSS" -gt 0 ]; then say "scale + local fonts in built css" "ok"; else say "scale + local fonts in built css" "FAIL"; fail=1; fi

ORDER=$(node -e "
const fs=require('fs');
const f=fs.readdirSync('dist/assets').find(x=>x.endsWith('.css'));
const c=fs.readFileSync('dist/assets/'+f,'utf8');
process.stdout.write(c.lastIndexOf('.tp-page{font-size')>c.indexOf('.text-xs')?'0':'1');
" 2>/dev/null)
check "scale loads after tailwind utilities" "${ORDER:-1}"

NAMES="app-page app-stack tp-page tp-section tp-card tp-lead tp-body tp-prose tp-meta tp-eyebrow tp-hero tp-card-body tp-empty-note"
MISSING=0
for n in $NAMES; do grep -q "\.$n" dist/assets/*.css || { echo "  purged: $n"; MISSING=$((MISSING+1)); }; done
check "all 13 scale rules survive the build" "$MISSING"

# The cascade, checked in a real engine rather than by reading byte offsets.
# Two ways to get this wrong and neither shows up in a build: the scale can lose
# to a stray text-xs, or it can beat a font-semibold it was never meant to touch.
# Both have happened once already.
if [ -f /tmp/cc.mjs ] && command -v node >/dev/null; then
  if node /tmp/cc.mjs >/tmp/cc.log 2>&1; then say "cascade behaves in a browser" "ok"
  else say "cascade behaves in a browser" "FAIL"; cat /tmp/cc.log; fail=1; fi
fi

echo
[ "$fail" -eq 0 ] && echo "all checks passed" || echo "FAILURES ABOVE"
exit $fail
