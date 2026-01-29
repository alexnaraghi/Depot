---
created: 2026-01-29
title: Move files when editing default CL description
area: ui
files:
  - src/components/changelist (likely location)
---

## Problem

When editing the description for the default changelist, a new numbered changelist is created (per decision D-04-02-02), but files from the default changelist are not moved to the newly created changelist. Expected behavior: editing the default CL description should create a numbered changelist AND move all files currently in the default changelist to it.

## Solution

After creating the new numbered changelist from the default CL description edit, call p4_reopen to move all files from default to the new changelist number.
