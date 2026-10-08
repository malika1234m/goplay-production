#!/bin/sh
# Lines that probably still hold untranslated English (for manual follow-up after the automatic pass).
grep -nE '"[A-Z][a-z][^"]*"|`[^`]*[a-z]{3,}[^`]*`|>[^<{}]*[a-z]{3,}[^<{}]*\{|\}[^<{}"`]*[a-z]{3,}[^<{}]*<|toLocale(Date|Time)?String\("en|Rs\. |^\s+[A-Z][a-z]+( [a-z]+)*[^<>{}=;]*$' "$1" \
 | grep -vE 't\("|tn\(|tk\("|className=|^[0-9]+:\s*(//|\*|/\*|import)|fetch\(|"Content-Type"|/api/|\{/\*|href=\{?`/|^[0-9]+:\s+[a-z]\w*[,;]?$'
