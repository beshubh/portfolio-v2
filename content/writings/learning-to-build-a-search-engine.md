---
title: Learning to Build a Search Engine
date: 2026-06-13
summary: What crawling, indexing, merging, and phrase search taught me about information retrieval.
tags: [search, systems, rust]
status: published
---

Building [Harvest](https://github.com/beshubh/harvest) changed search engines from a familiar interface into a series of concrete engineering decisions.

## Crawling is a control problem

Fetching pages is the easy part. The harder questions are about control: which URLs deserve work, how much concurrency a host should receive, when two URLs represent the same resource, and how failures affect the frontier.

A useful crawler needs boundaries. Without them, concurrency only makes waste happen faster.

## An index is built around the questions it must answer

An inverted index maps terms to documents. Phrase search requires more: the positions of those terms inside each document. That extra capability changes the data model, memory use, and merge process.

I used SPIMI to build bounded in-memory segments and flush them to disk. A k-way merge then combined those sorted segments into the final index. The important lesson was not the acronym. It was learning to shape an algorithm around a resource limit.

## The useful work happens between the components

The crawler, analyzer, indexer, and query engine are individually understandable. Their boundaries carry the difficult decisions: normalization, document identity, partial failures, memory ownership, and the format written to disk.

That is what I now look for when learning another system—not only its components, but the contracts holding them together.
