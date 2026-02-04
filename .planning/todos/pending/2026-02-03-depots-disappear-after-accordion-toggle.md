---
created: 2026-02-03
title: Depots disappear after minimizing/maximizing accordions
area: ui
files: []
---

## Problem

Depots disappear and show "no depots found" after minimizing and maximizing the accordions in the main layout. The exact trigger is unclear, but once they disappear they never come back without a full app restart (and possibly not even then).

Note: Related to existing todo `2026-02-01-fix-depot-accordion-header-visibility.md` but this is a different issue — depots vanishing entirely vs. header visibility.

## Solution

Investigate accordion state management and how it interacts with depot data fetching. Likely the depot query gets disabled or the data gets cleared when the accordion collapses and doesn't re-fetch on expand.
