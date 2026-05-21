# Chunk ID Positioning Research

## Question

Can AI-generated learning notes let the AI specify the note position by reusing the `chunk_id` behavior from existing RAG tools?

## Findings

### What `chunk_id` Is

`chunk_id` is the SQLite primary key for rows in the per-book vector database table `document_chunks`.

Each chunk stores:

* `id` / `chunk_id`
* `book_title`
* `book_author`
* `md_file_path`
* `file_order_in_book`
* `related_chapter_titles`
* `chunk_text`
* `chunk_order_in_file`
* `total_chunks_in_file`
* `global_chunk_index`

The schema does not store reader CFI, EPUB spine index, original DOM range, or an offset that can be directly turned into an exact reader selection.

### How RAG Tools Use It

Existing RAG tools already use `chunk_id` as the model-visible source anchor:

* `ragSearch` returns relevant chunks and tells the model to cite them as `[chunk_id]`.
* `ragContext` accepts a `chunk_id` and fetches neighboring chunks by `global_chunk_index`.
* `ragToc` returns all chunks for a chapter with their `chunk_id`s.
* `ragRange` can retrieve continuous chunks by global index, although it is currently exported but not attached in `CustomChatTransport`.

This makes `chunk_id` a good fit for AI-selected evidence. The model can choose the source chunks that justify a learning note.

### What It Cannot Do Today

`chunk_id` is not currently a reader location.

The existing independent note model supports reader navigation through `notes.cfi`. Reader-selected notes get an exact CFI from `view.getCFI(selection.index, selection.range)`. RAG chunks are produced from the mdBook conversion pipeline and are stored with Markdown file/chunk ordering data, not with Foliate CFI data.

There is no existing safe bridge from `document_chunks.id` to `notes.cfi`.

### Practical Implication

For the MVP, AI-generated learning notes should not treat chunks as note positions. RAG chunks can help the AI identify relevant evidence, but the AI should provide short verbatim source candidates. The frontend can then try to resolve those candidates to a real reader CFI through Foliate search.

Reader-selection notes remain exact source-bound notes with `cfi`, `sourceText`, and nearby context.

Learning-note quick actions use a different source mode:

* source: recent chat history + current chapter/RAG context
* position: AI-selected source candidates, confirmed through Foliate search when possible
* saved note: existing `notes` row with `bookId` + `bookMeta`; `cfi` comes from reader selection, confirmed Foliate search, or the current chapter start fallback
* note body: concise synthesized takeaways plus citations and/or a short "来源片段" section

## Recommended MVP Contract

Add a `createNote` AI tool that accepts:

* `title`
* `content`
* optional `bookId` inferred from chat context
* optional `cfi` only when supplied by a real reader location/selection path
* optional `sourceText`
* optional `contextBefore`
* optional `contextAfter`
* optional `sourceCandidates` for Foliate-search CFI confirmation

Because the current `notes` table already has `cfi` and `sourceText`, the MVP should try to convert `sourceCandidates` into real `cfi` values through Foliate search. If that fails, attach the note to the current chapter start when available.

## Risk

The existing RAG tool descriptions call `chunk_id` "精确定位/标注", but that precision is relative to the vector/mdBook chunk database. It is not the same as an EPUB CFI reader target. The implementation should avoid promising "打开原文" from `chunk_id` unless a separate chunk-to-reader navigation bridge is built.
