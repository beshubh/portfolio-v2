---
title: Building search engine from scratch using Rust
date: 2026-06-27
summary: Search has one of the simplest interfaces in software: type text and press enter.
tags: [search, systems, rust]
status: published
---

Search has one of the simplest interfaces in software: type text and press enter.

That simplicity though hides a long chain of systems problems. Before a result can appear, something has to discover pages, extract useful text, normalize that text, build an efficient index out of it, and finally your query gets executed and you get the results.

I understood these steps in theory. But as ambitious I am with learning these things myself, I thought “you know what? lets build it.”

That gave birth to the [Harvest](https://github.com/beshubh/harvest). A full-text search engine written in Rust. It crawls the web, builds a positional inverted index on top of MongoDB, and serves multi-term searches through an Axum API (Rust http server stuff).

> As I went deep into this, I realized quickly that it was a mistake and this is also gonna go into the graveyard of my un-finished projects, but luckily or willfully-it didn’t.

I am writing this to document what I have learnt by building it.

## Overview

There are three parts to search engine:

- where to get the data from: **Crawler**
- how to store textual data efficiently: **Inverted Index**
- how to query data efficiently: **Query Engine**

## Crawler

Crawler takes a bunch of seed urls, from there, it fetches each page, extracting links on it, and continues following those links. Basically it recursively traverses the web. Something like this for visual learners.

![](https://substackcdn.com/image/fetch/$s_!oh_h!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa13bc4c7-a73a-435c-828f-98e41ba62d41_2232x1356.png)

Now you see this and you can quickly realize, its basically a graph and you to have visit all the nodes of the graph, you have to do this fast, but not so fast that you get blocked and you have to be **careful** with few other things:

- do not keep going deeper and deeper as internet is vast and one page can actually link to like a million others.
- do not go into infinite recursion visiting same pages.
- take care of stack depth if you do it recursively (idk if its possible without recursion, my 2 braincells can’t figure that if you do lmk)

What to do for each of these problems.

**Careful to not get blocked**: I use a Semaphore here, it limits the amount of concurrent requests I can make to web page. Semaphore is like a lock but with a limit, lock you can acquire just once but semaphore let’s you set a limit and for that limit you can spawn a thread or an async task, which is what gonna fetch URL concurrently.

**Depth: **I use configurable `depth_limit` parameter, as we keep going down the graph keep incrementing the depth with page, and if depth crosses depth_limit, stop.

**Infinite recursion**: I keep a set of visited URLs, one thing to be careful here is normalizing the URL first as two urls like `http://a.com?b=10` and `http://a.com` are actually same (for the most part) so both of these should be normalized to `http://a.com` before putting the set.

```
discovered links
    -> bounded frontier
    -> concurrent fetch tasks
    -> semaphore
    -> website
```

Each page gets stored in mongodb collection, I call it `pages` with simple schema.

```
source_url: text
title: text
content: text
depth: number
```

## Text Analysis

Once the crawling is done, you have to clean that html that you just fetched.

Real HTML contains far more than article text:

- Navigation menus.
- Headers and footers.
- Cookie banners.
- Advertisements.
- Scripts and style rules.
- Punctuation and numbers.
- Common words that add little retrieval value.

Indexing all of that would produce a technically valid but very noisy search engine.

Harvest therefore runs every document through a text-analysis pipeline: This is similar to what ElasticSearch uses. I have also taken inspiration from their documentation.

```
HTML
  -> visible-content extraction (from html)
  -> tokenization
  -> punctuation removal
  -> lowercase conversion
  -> numeric filtering
  -> stop-word removal
  -> Porter stemming
  -> terms with positions
```

This pipeline consists of:

1. HTMLTagFilter
2. Tokenizer
3. TokenFilter
4. LowerCaseTokenFilter
5. StopWordTokenFilter
6. and some other filters like stemming, punctuations stripping

**HTMLTagFilter**: extracts the HTML from the page and gives concrete set of fields for each page: title, body, anchors, headings etc

**Tokenizer**: can be of multiple types but job is just to break the input stream of text into individual tokens, for instance a whitespace tokenizer breaks text into tokens whenever it sees any whitespace. It would convert “Quick brown fox!”  → [“Quick”, “brown”, “fox!”]

**TokenFilter**: receives a token stream and may add, remove, or change tokens. For example, a lowercase token filter converts all tokens to lowercase, a stop word token filter removes stop words from the token stream.

After text analysis is done, we have a token stream(or array) each belonging to a single page.

# Indexing

This is the hardest part!

So documents naturally arrive in this form:

```
doc-1 -> [rust, search, engine]
doc-2 -> [rust, crawler]
doc-3 -> [search, index]
```

each document has basically token stream (or array), (this is not stored as an array in mongo but can be easily converted at runtime)

But a query such as `rust search` asks the opposite question:

> Which documents contain these terms?

With this current structure you do a O(N*K) operations to find the related documents. (where N is number of documents and K is number of tokens in each document)

Now, if you are remotely familiar with computer science you’d know that this won’t scale, you can’t scan a million documents for every single query.

Scanning every document for every query would become slower as the corpus grows.

So we invert.

An inverted index reverses the relationship:

we take each keyword and create a reverse mapping, this is also called posting lists.

word → [posting list of documents where it exists]

```
rust    -> [doc-1, doc-2]
search  -> [doc-1, doc-3]
engine  -> [doc-1]
crawler -> [doc-2]
index   -> [doc-3]
```

Now the query engine can retrieve two posting lists and intersect them:

```
rustdocs = [doc-1, doc-2]
searchdocs = [doc-1, doc-3]

result = intersect(rustdocs, searchdocs)

result -> [doc-1]
```

This reversal is the conceptual centre of a text search engine. Querying becomes a data-structure problem instead of a document-scanning problem. I will talk more about querying later though, first we need to handle the memory problem, a single term can exist in hundreds of millions of documents, all that might not be possible to fit in machine memory and that leads us to.

### SPIMI

Single-Pass In-Memory Indexing.

The naive indexer keeps one large in-memory map:

This design has no natural upper bound. A larger corpus creates more terms, postings, and positions until the process runs out of memory.

SPIMI builds the dictionary in memory until it reaches a memory budget. It then sorts the terms, persists the block, clears memory, and continues with the token stream.

This algorithm works like this

```
/// token = tuple[term, docId]
/// token_stream is sorted by docIds
/// SPIMI(token_stream)
///     output_file = NEWFILE() // mongo collection in my case
///     dictionary = HashMap()
///     while free_mem_available:
///         do token <- next(token_stream)
///            if token.term not in dictionary:
///                 postings_list = add_dict(dictionary, token.term)
///            else postings_list = get_dict(dicitonary, token.term)
///
///           postings_list.push(token.docId)
///
///     sorted_terms = sort_dict_keys(dictionary)
///     write_block_to_disk_storage(sorted_terms, dictionary, output_file) // mongo collection in our case
```

![](https://substackcdn.com/image/fetch/$s_!0c9V!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa6c7face-e22b-46df-a244-60676b12cc1f_899x305.png)

The idea is simple, but it changes the failure model of the indexer. Corpus size no longer determines peak dictionary size, configured budget does.

Larger inputs create more blocks rather than requiring one larger allocation.

Harvest persists temporary SPIMI blocks as MongoDB collections. This keeps the blocks durable and provides sorted database cursors for the merge phase.

The result  we will get is something like this:

```
term1: [posting list],
term2: [posting_list],
term3: [posting list],
term1: [posting list2 for term1],
term2: [posting list2 for term2],
term1: [posting list3 for term1]
```

And in the next phase of indexing we merge all of these together, If you have solved problem [Merge k sorted lists on leetcode](https://leetcode.com/problems/merge-k-sorted-lists/description/), this is pretty similar to that.

## K-way merge

After SPIMI runs, the engine has several individually sorted blocks as shown above, in this phase we just merge them to form a final index. So above will be transformed into this:

```
term1: [posting list U posting list2 U posting list 3],
term2: [posting_list U postings list2],
term3: [posting list]
```

Obviously loading all blocks back into memory would undo the reason for creating them.

Harvest instead performs a k-way merge.

It opens a sorted cursor for every block and places the current item from each cursor into a min-heap. The smallest term is popped, merged into the active term, and replaced with the next item from the same cursor.

![](https://substackcdn.com/image/fetch/$s_!wAXn!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fcbd553f9-b945-43a2-8b91-af21cca9b576_861x277.png)

If there are `k` blocks, the heap only needs to track roughly one current item per block. Choosing the next item costs `(log k)`.

The sorted runs are valuable because they let the system make progress while holding only a small window of the complete dataset.

Harvest also checkpoints merge progress by term and bucket. If the process stops midway, it can resume from durable progress rather than restart the entire merge.

The checkpointing is not part of the textbook definition of an inverted index, but it becomes necessary as indexer can die in the middle of indexing.

## Finally: bucketing terms across multiple mongo docs

MongoDB limits a BSON document to 16 MB. A frequent term can eventually produce a posting list too large for one document.

Harvest handles this by splitting a term across buckets:

```
{ term: “rust”, bucket: 0, postings: [...] }
{ term: “rust”, bucket: 1, postings: [...] }
{ term: “rust”, bucket: 2, postings: [...] }
```

The query engine combines those buckets before evaluating the query.

Logically, `rust` has one posting list. Physically, that list may span several MongoDB documents. The repository implementation and query layers basically hide the split.

The indexer also supports append-oriented incremental indexing. It processes pages that have not been indexed, then appends their postings to existing term buckets where space remains.

This avoids rebuilding the full corpus whenever the crawler discovers new pages. Supporting updates and deletion would require a stronger model because old postings must also be removed, but append-only growth already exposed the core problem.

With this we are done with indexing.

## Querying

With all this indexing infrastructure that we built, now querying should be pretty straight forward(with a couple of nuances).

To find the page that contains “rust search” we can simply do a query on `index` collection with

```
{ term: { $in: ["rust", "search"] } }
```

we will get all postings lists where rust or search exists and then we do intersection of those two lists, get all document ids, and give the results back to the user.

But this will return documents that contains “rust” and “search” keywords, which is not exactly what we want, we want docs where “rust” and “search” appears together. For instance we want this doc for the query:

```
rust search is a growing field bla bla bla
```

Not this:

```
rust^ is very difficult and no body should learn, you can go online and search^ for the resources bla bla.
```

rust and search do appear in this doc but they are not close together. And for that we are going to use the map from doc id → positions that we have stored for each term. This is called phrase search.

## Phrase search

![](https://substackcdn.com/image/fetch/$s_!xA5X!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6060333f-d6bd-4c07-9994-aaa0ca5bf2c5_1350x361.png)

A normal posting list can tell us that two terms occur in the same document. It cannot tell us whether they occur together.

let’s say we are searching for `distributed systems`

Harvest stores each term’s positions within every document:

```
term: "distributed",
postings_list: [doc1, ...],
positions: {
  doc1:
    distributed -> [4, 18]
}

term: "systems",
postings_list: [doc1, ...],
positions: {
  doc1:
    systems -> [5, 31]
}
```

The document (doc1) contains both terms, but only positions `4` and `5` form the adjacent pair `distributed systems`.

So the result of this search will just be `doc1`

Algorithm here involves two things: a normal set intersection and positional intersection, former is simple but later is much more complicated

**Algorithm**:

- Fetch the postings list for each term of the query.
- Start with the shortest posting list, as rare term is more selective it will produce a smaller intermediate result than a common term.
- Keep intersecting the shortest posting list with other lists.
  - while normal intersection b/w two vectors is easy but, for the phrase queries we need to do positional intersection.
    - positional_intersection takes two postings lists of two different terms, their positions map, and distance k.
    - does the intersection of two postings based on positions of each term, if the distance b/w the term position is at most k we take the document otherwise discard it.
  - return the intersected documents.
- repeat above for all the posting lists.
- return documents to the user.

That is the same idea used in database query planning: apply the condition that eliminates the most candidates first.

done!

## Unfinished edges

- Crawler & Indexer is not distributed.
- Harvest’s current positional query implementation still has an edge around ordered chaining across longer phrases.
- and some other things that you probably can find in source.

The source is available at [github.com/beshubh/harvest](https://github.com/beshubh/harvest)
