#!/bin/sh
# Broad scan for English that may still need t(): JSX text mixed with {expr}, quoted words, template literals.
for f in "$@"; do
  echo "=== $f"
  grep -nE '>[^<{}]*[A-Za-z]{3,}[^<{}]*\{|\}[^<{}"`]*[A-Za-z]{3,}[^<{}]*<|"[A-Z][a-z]+[^"]*"|`[^`]*[a-z]{3,} [a-z]{2,}[^`]*`|^\s+[A-Z][a-z]+( [a-z]+)*[.:]?\s*$' "$f" \
   | grep -vE 'className=|^\s*[0-9]+:\s*(import|//|\*|/\*)|t\("|tn\(|tk\("|console\.|fetch\(|"Content-Type"|href=|key=|/api/|toLocale|\{/\*' 
done
