# Corpora

Prose from Wikisource and Project Gutenberg, plus one short synthetic text, `mixed-app-text.txt`. `sources.json` names each file's source page; a file's license is that page's, and nothing here records it.

Editing a file can change the harness's real-usage sample (`bun test` then fails until the sample is drawn again and its new cases recorded), the Markdown chat demo's messages and the real-usage sample's AI replies drawn from them, and the bench's messages. The harness's census, books and smoke sets (`harness/cases/`) were cut from these files once and don't change.

A new file should bring a script the others lack, such as Lao, as published: no page scaffolding or print line wrapping, and the source's own ZWSPs kept.
