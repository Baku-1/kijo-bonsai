# Architecture: Second Brain (AI Knowledge Vault)

**Status:** APPROVED  
**Author:** Jeremy Gordon / Claude (Architect)  
**Date:** 2026-09-01  
**Pattern:** Karpathy LLM Wiki (April 2026)

---

## 1. Design Task

```
DESIGN TASK:  Docker-based "Second Brain" — a persistent, structured knowledge vault
              that Claude can read, write, search, and grow across Cowork sessions.
DELIVERABLE:  Architecture doc with system diagram, tech choices, MCP tool definitions,
              wiki structure, migration plan, and phased build plan.
BUILDS ON:    Karpathy LLM Wiki gist (https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f),
              existing Cowork memory system, kijo project docs.
CONSUMED BY:  Jeremy (owner), Claude (implementer in future sessions).
```

---

## 2. Verification Log

```
VERIFIED:
  ✓ Karpathy LLM Wiki gist exists at gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
    — Published April 4, 2026. Three-layer architecture: raw/ (immutable sources),
      wiki/ (LLM-maintained), schema file (conventions). Three operations: ingest,
      query, lint. Went viral (~16M views).
  ✓ ChromaDB default embedding is all-MiniLM-L6-v2 via ONNX Runtime (384 dims)
    — Source: docs.trychroma.com/docs/embeddings/embedding-functions
  ✓ ChromaDB runs in Docker with single command: docker pull chromadb/chroma
    — Source: oneuptime.com/blog/post/2026-02-08-how-to-run-chromadb-in-docker-for-embeddings
  ✓ nomic-embed-text: 137M params, 768 dims, 8192 context, Apache-2.0, best local CPU model
    — Source: morphllm.com/ollama-embedding-models, d-central.tech/local-embedding-models
  ✓ FastMCP 3.0 released Jan 19, 2026 — production-ready MCP server framework for Python
    — Source: firecrawl.dev/blog/fastmcp-tutorial-building-mcp-servers-python
    NOTE: Now at v3.4.6 (Aug 31, 2026). Implementation should target 3.4+ for
    native Streamable HTTP support (SSE deprecated April 2026).
  ✓ No existing wiki/knowledge-base MCP connector in the Claude MCP registry
    — Verified: searched registry with keywords, returned empty results.
    NOTE: Three post-Karpathy MCP servers (llm-wiki-mcp, llmwiki, MindBase) exist
    on GitHub but are not in the registry. Evaluated in Section 3 — BUILD still preferred.
  ✓ Existing kijo docs: 32 files in kijo/docs/, 130 files in kijo/kijo-bonsai/docs/,
    ~55,762 total lines of markdown across both directories
  ✓ Docker Desktop installed on Jeremy's Windows machine (stated in requirements)

UNVERIFIED (could not confirm):
  ? vault-mcp (robbiemu) Docker support — project description mentions it but no
    Dockerfile found in search results. Unclear if production-ready.
  ? MCP-Markdown-RAG (Zackriya-Solutions) Docker support — uses Milvus (heavy),
    no Docker compose found in search results.

REFUTED:
  ✗ "Existing MCP knowledge-base servers are ready to use" — while several exist
    on GitHub (vault-mcp, MCP-Markdown-RAG, obsidian-mcp, knowledge-base-server),
    none are mature enough for production use. Most are single-developer projects
    with unclear maintenance status. Build-custom is the safer path, using them
    as reference implementations.
```

---

## 3. Build vs Buy Decision

### Existing Open-Source MCP Servers Evaluated

| Project | Stars | Embedding | Vector DB | Docker | Verdict |
|---------|-------|-----------|-----------|--------|---------|
| [vault-mcp](https://github.com/robbiemu/vault-mcp) | Low | Pluggable | ChromaDB | Unclear | Too complex, unclear maintenance |
| [MCP-Markdown-RAG](https://github.com/Zackriya-Solutions/MCP-Markdown-RAG) | ~200 | Built-in | Milvus | No compose | Milvus is overkill for local use |
| [obsidian-mcp](https://github.com/StevenStavrakis/obsidian-mcp) | Moderate | None | None | No | Read/write only, no semantic search |
| [knowledge-base-server](https://github.com/willynikes2/knowledge-base-server) | Low | Built-in | SQLite FTS5 | No | No vector search, just full-text |
| [obsidian-semantic-mcp](https://github.com/aaronsb/obsidian-semantic-mcp) | Low | Unknown | Unknown | Unknown | Insufficient docs to evaluate |

#### Post-Karpathy MCP Servers (published after April 2026)

| Project | Description | Docker | Verdict |
|---------|-------------|--------|---------|
| [llm-wiki-mcp](https://github.com/flsteven87/llm-wiki-mcp) | Karpathy-pattern MCP server, 4 tools (read, write, log, inventory) | Unknown | Directly implements same pattern, but fewer tools than we need |
| [llmwiki](https://github.com/lucasastorian/llmwiki) | Open-source MCP server: search/read/write/lint | Unknown | Near-identical feature set, but no semantic vector search |
| [MindBase](https://github.com/frankchu91/mindbase) | Full Karpathy impl + MCP + web UI + Ollama | Unknown | Most complete; npm-based, not Python — different stack |

### Decision: BUILD CUSTOM (lightweight)

**Rationale:** Three post-Karpathy MCP servers now exist (llm-wiki-mcp, llmwiki, MindBase), but none combine all our requirements: Obsidian-compatible markdown vault + semantic vector search + Docker single-container + Python/FastMCP stack + custom tool set (7+ tools including `ingest_source` and `delete_page`). llm-wiki-mcp has only 4 tools. llmwiki lacks vector search. MindBase is npm-based with a web UI we don't need. Building custom with FastMCP + ChromaDB is straightforward (~500 lines of Python), gives full control, and avoids adapting someone else's opinionated structure to our wiki layout.

**Risk mitigation:** Use llm-wiki-mcp, llmwiki, vault-mcp, and MCP-Markdown-RAG as reference implementations for chunking strategy and MCP tool design.

---

## 4. System Architecture

### 4.1 System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Jeremy's Windows Machine                                   │
│                                                             │
│  ┌──────────────┐  MCP (Streamable HTTP) ┌────────────────┐  │
│  │  Claude       │◄────────────────────►│  Docker:       │  │
│  │  (Cowork)     │                      │  second-brain  │  │
│  └──────────────┘                       │                │  │
│                                         │  ┌───────────┐ │  │
│  ┌──────────────────────────┐           │  │ FastMCP   │ │  │
│  │  Obsidian (optional)     │           │  │ Server    │ │  │
│  │  Views the same vault    │           │  │ (Python)  │ │  │
│  └─────────┬────────────────┘           │  └─────┬─────┘ │  │
│            │                            │        │       │  │
│            │ reads                      │        │       │  │
│            ▼                            │        ▼       │  │
│  ┌──────────────────────────────────────┤  ┌───────────┐ │  │
│  │                                      │  │ ChromaDB  │ │  │
│  │  📁 playground/second-brain/          │  │ (embedded)│ │  │
│  │  ├── raw/          ← immutable docs  │  └───────────┘ │  │
│  │  ├── wiki/         ← LLM-maintained  │                │  │
│  │  ├── index.md      ← content catalog │  Volume mount: │  │
│  │  ├── log.md        ← operation log   │  playground/   │  │
│  │  └── .chroma/      ← vector store    │                │  │
│  │                                      │                │  │
│  │  (volume-mounted into Docker)        └────────────────┘  │
│  └──────────────────────────────────────────────────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Key Design Decisions

1. **ChromaDB embedded in the MCP server container** (not a separate container).
   ChromaDB supports embedded mode — it runs in-process with the Python server.
   This eliminates container-to-container networking complexity and keeps the
   deployment to a single `docker compose up`.

2. **Volume-mounted vault** — the `second-brain/` folder lives at
   `playground/second-brain/` (inside Jeremy's connected Cowork folder). Docker
   mounts it read-write. Obsidian can open the same folder simultaneously for browsing.

3. **ChromaDB's default all-MiniLM-L6-v2** for Phase 1 embedding. It's built into
   ChromaDB (zero extra setup), runs on CPU, and produces 384-dim vectors. Good
   enough to start. Phase 2 can swap to nomic-embed-text (768 dims, 8192 context)
   via Ollama if retrieval quality needs improvement.

4. **MCP over Streamable HTTP** rather than stdio, so the Docker container exposes a
   port that Claude's MCP config can connect to. FastMCP 3.4+ supports this natively.
   (SSE transport was deprecated April 2026 and replaced by Streamable HTTP.)

---

## 5. Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **MCP Framework** | FastMCP 3.4+ (Python) | Production-ready, excellent docs, native Streamable HTTP support, Docker examples available |
| **Vector DB** | ChromaDB (embedded mode) | Simplest local option, built-in embedding, no separate server needed, pip install |
| **Embedding Model (Phase 1)** | all-MiniLM-L6-v2 (via ChromaDB default) | Zero-config, CPU-friendly, ~80MB, built into ChromaDB's ONNX runtime |
| **Embedding Model (Phase 2)** | nomic-embed-text (via Ollama) | 8192 token context (vs 256), better retrieval quality, Apache-2.0 |
| **Wiki Format** | Obsidian-compatible Markdown + YAML frontmatter | Human-readable, version-controllable, Obsidian browsable |
| **Container Runtime** | Docker Desktop (Windows) | Already installed, single-container deployment |
| **Language** | Python 3.12 | FastMCP + ChromaDB are both Python-native |

### Why NOT Qdrant or LanceDB?

**Qdrant:** Superior for production at scale (5M+ vectors, horizontal scaling, payload-aware HNSW). Overkill for a personal wiki with ~200-500 pages. Requires a separate container. More complex to configure.

**LanceDB:** Excellent embedded option (SQLite-like), but less mature ecosystem, fewer MCP examples, and ChromaDB's built-in embedding function eliminates the need for a separate embedding pipeline.

---

## 6. Wiki Structure

### 6.1 Folder Layout

```
second-brain/
├── SCHEMA.md                    # Conventions for Claude (the "schema" layer)
├── index.md                     # Master catalog — fits in one context window
├── log.md                       # Append-only operation log
│
├── raw/                         # Immutable source materials (Claude reads, never writes)
│   ├── kijo/                    # Migrated from kijo/docs/ and kijo-bonsai/docs/
│   │   ├── GDD.md
│   │   ├── KIJO-TECH-SPEC.md
│   │   ├── KIJO-ARCHITECTURE.md
│   │   ├── KIJO-ENGINE-API.md
│   │   ├── KIJO-PRD.md
│   │   ├── DECISIONS.md
│   │   └── pipeline/            # All ARCH-*, AUDIT-*, IMPL-* docs
│   ├── axie-wargrounds/
│   ├── the-outlet/
│   └── references/              # Articles, research, external resources
│
├── wiki/                        # LLM-generated and maintained
│   ├── overview.md              # High-level project landscape
│   ├── projects/
│   │   ├── kijo.md              # Project summary, status, key decisions
│   │   ├── kijo-bonsai.md       # Phase 1 monorepo status
│   │   ├── axie-wargrounds.md
│   │   └── the-outlet.md
│   ├── concepts/
│   │   ├── kijonsai.md          # The tree NFT concept
│   │   ├── slp-dual-potion.md   # SLP burn mechanics
│   │   ├── flower-guild-rank.md
│   │   ├── care-actions.md
│   │   └── ...
│   ├── decisions/
│   │   ├── species-technique-archetypes.md
│   │   ├── stat-defense-stability.md
│   │   └── ...
│   ├── patterns/
│   │   ├── architect-critic-implementer-auditor.md
│   │   ├── deterministic-rng.md
│   │   └── ...
│   ├── entities/
│   │   ├── ronin-network.md
│   │   ├── axie-infinity.md
│   │   └── ...
│   └── lessons/
│       ├── wireangle-cascade-bug.md
│       └── ...
│
└── .chroma/                     # ChromaDB persistent storage (gitignored)
```

### 6.2 Page Template (YAML Frontmatter)

```yaml
---
title: "SLP Dual Potion Design"
page_type: concept               # project | concept | decision | pattern | entity | lesson
project: kijo                   # which project this belongs to
tags: [tokenomics, slp, ronin, combat]
created: 2026-08-15
updated: 2026-09-01
source: raw/kijo/DESIGN-SLP-DUAL-POTION.md   # link to raw source, if any
status: active                   # active | superseded | draft
related:                         # wiki-style links
  - "[[kijo]]"
  - "[[flower-guild-rank]]"
  - "[[care-actions]]"
---

# SLP Dual Potion Design

## Summary
One-paragraph distillation of the concept.

## Details
Full explanation, cross-linked to other wiki pages.

## Key Decisions
Numbered list of decisions made and rationale.

## Open Questions
Anything unresolved.
```

### 6.3 index.md Format

```markdown
# Second Brain Index

Last updated: 2026-09-01 | Pages: 47 | Sources: 166

## Projects
- [[kijo]] — Dual-loop bonsai/combat blockchain game on Ronin
- [[kijo-bonsai]] — Phase 1 bonsai care TypeScript monorepo
- [[axie-wargrounds]] — Phaser RTS battle royale prototype
- [[the-outlet]] — Wallet/avatar/trade work

## Concepts (15)
- [[kijonsai]] — The tree NFT, growth model, species
- [[slp-dual-potion]] — Soothing Leaf Potion (care) vs Smooth Love Potion (combat)
...

## Decisions (12)
- [[species-technique-archetypes]] — Hardwood/Evergreen/Tropical mapped to techniques
...

## Patterns (5)
- [[architect-critic-implementer-auditor]] — The development pipeline
...

## Entities (8)
- [[ronin-network]] — L1 blockchain, RON token
...

## Lessons (7)
- [[wireangle-cascade-bug]] — Angle unit mismatch caused cascade failure
...
```

---

## 7. MCP Tool Definitions

The MCP server exposes these tools to Claude:

### 7.1 `search_wiki`
Semantic search across the wiki using vector similarity + optional keyword filter.

```python
@mcp.tool()
async def search_wiki(
    query: str,           # Natural language query
    top_k: int = 5,       # Number of results to return
    project: str = None,  # Filter by project (e.g., "kijo")
    page_type: str = None, # Filter by page type (concept, decision, etc.)
) -> list[SearchResult]:
    """Search the wiki using semantic similarity.
    Returns: list of {path, title, score, snippet} objects."""
```

### 7.2 `read_page`
Read a wiki page by path or title.

```python
@mcp.tool()
async def read_page(
    path: str,            # Relative path within second-brain/ (e.g., "wiki/concepts/kijonsai.md")
) -> PageContent:
    """Read a wiki page. Returns: {path, frontmatter, content, related_pages}."""
```

### 7.3 `write_page`
Create or update a wiki page. Auto-updates the vector index and index.md.

```python
@mcp.tool()
async def write_page(
    path: str,            # Relative path (e.g., "wiki/concepts/new-concept.md")
    content: str,         # Full markdown content including YAML frontmatter
    log_entry: str = "",  # Optional log message for log.md
) -> WriteResult:
    """Create or update a wiki page. Auto-indexes in ChromaDB.
    Returns: {path, created_or_updated, indexed}."""
```

### 7.4 `list_pages`
List pages with optional filtering.

```python
@mcp.tool()
async def list_pages(
    page_type: str = None, # Filter by type (avoids shadowing Python's built-in `type`)
    project: str = None,  # Filter by project
    prefix: str = None,   # Filter by path prefix (e.g., "wiki/decisions/")
) -> list[PageSummary]:
    """List wiki pages. Returns: list of {path, title, type, project, updated}."""
```

### 7.5 `ingest_source`
Ingest a raw source document into the wiki (the Karpathy "ingest" operation).

```python
@mcp.tool()
async def ingest_source(
    source_path: str,     # Path to raw source file (e.g., "raw/kijo/GDD.md")
    target_pages: list[str] = None,  # Wiki pages to create/update from this source
) -> IngestResult:
    """Ingest a raw source into the wiki. Reads the source, extracts key concepts,
    and either creates new wiki pages or updates existing ones.
    
    Default behavior (target_pages=None): indexes the source in ChromaDB only
    (chunks by heading, embeds, stores with source metadata). Does NOT auto-create
    wiki pages — Claude must explicitly specify target_pages or call write_page
    separately. This keeps wiki page creation human-in-the-loop.
    
    Returns: {source, chunks_indexed, pages_created, pages_updated, log_entry}."""
```

### 7.6 `read_index`
Read the master index (fits in one context window).

```python
@mcp.tool()
async def read_index() -> str:
    """Read the master index.md file. This is the starting point for
    navigating the wiki — always read this first."""
```

### 7.7 `delete_page`
Delete or archive a wiki page. Removes it from ChromaDB and optionally moves it to `archive/`.

```python
@mcp.tool()
async def delete_page(
    path: str,            # Relative path within second-brain/ (e.g., "wiki/concepts/old-concept.md")
    archive: bool = True, # If True, move to archive/ instead of deleting. If False, permanently delete.
    log_entry: str = "",  # Optional log message for log.md
) -> DeleteResult:
    """Delete or archive a wiki page. Removes from ChromaDB index and updates index.md.
    Returns: {path, action: 'archived' | 'deleted', indexed_removed: bool}."""
```

### 7.8 `read_log`
Read recent operation log entries.

```python
@mcp.tool()
async def read_log(
    last_n: int = 10,     # Number of recent entries
) -> str:
    """Read the last N entries from log.md."""
```

---

## 8. Docker Deployment

### 8.1 Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy MCP server code
COPY server/ ./server/

# ChromaDB persistent storage + wiki vault are volume-mounted
VOLUME ["/vault"]

# FastMCP Streamable HTTP server
EXPOSE 8200

HEALTHCHECK --interval=30s --timeout=5s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8200/health')"

CMD ["python", "-m", "server.main"]
```

### 8.2 docker-compose.yml

```yaml
services:
  second-brain:
    build: .
    container_name: second-brain
    ports:
      - "127.0.0.1:8200:8200"
    volumes:
      - ./playground/second-brain:/vault    # The wiki vault in Jeremy's Cowork playground folder
    environment:
      - VAULT_PATH=/vault
      - CHROMA_PERSIST_DIR=/vault/.chroma
      - MCP_PORT=8200
      - EMBEDDING_MODEL=default  # ChromaDB's built-in all-MiniLM-L6-v2
    restart: unless-stopped
```

### 8.3 Claude MCP Config

Add to Claude Desktop / Cowork MCP settings:

```json
{
  "mcpServers": {
    "second-brain": {
      "url": "http://localhost:8200/mcp"
    }
  }
}
```

> **Note:** No `"transport"` key needed — Streamable HTTP is the default when a URL
> endpoint is specified. SSE transport was deprecated April 2026.

---

## 9. Migration Plan

### 9.1 Scope

| Source | Files | Lines | Action |
|--------|-------|-------|--------|
| kijo/docs/ (top-level) | 6 core docs (GDD, Tech Spec, etc.) | ~15K | Copy to raw/kijo/, ingest to wiki |
| kijo/docs/pipeline/ | 26 ARCH/AUDIT/IMPL docs | ~8K | Copy to raw/kijo/pipeline/ |
| kijo-bonsai/docs/ | 130 design/audit docs | ~33K | Copy to raw/kijo/, ingest to wiki |
| kijo-bonsai/DECISIONS.md | 1 file | ~500 | Copy to raw/kijo/, extract decisions |
| axie-wargrounds/ | 3 docs | ~1K | Copy to raw/axie-wargrounds/ |
| TitanAI/ | 7 docs | ~2K | Copy to raw/titanai/ (if desired) |
| Cowork memory files | Variable | Variable | Migrate relevant memories to wiki pages |

### 9.2 Migration Steps

**Phase 1 — Scaffold (manual, ~10 min)**
1. Create the `second-brain/` directory structure at `playground/second-brain/`
2. Copy raw source files to `raw/` (preserving project subdirectories)
3. Create `SCHEMA.md` with wiki conventions
4. Create empty `index.md` and `log.md`

**Phase 2 — Seed the wiki (Claude-assisted, ~30 min)**
1. Start the Docker container
2. Claude reads each core doc via `read_page` on raw sources
3. Claude creates wiki summary pages using `write_page`
4. Each write auto-indexes in ChromaDB
5. Claude builds `index.md` from the created pages

**Phase 3 — Cross-link and enrich (ongoing)**
1. Claude adds `related` links between pages
2. Claude extracts patterns and lessons from pipeline docs
3. New work automatically generates wiki entries

### 9.3 Migration Script (seed.py)

A Python script that:
1. Walks `raw/` directory
2. Reads each markdown file
3. Chunks by heading (H1/H2 boundaries)
4. Embeds and indexes each chunk in ChromaDB with metadata (source path, project, heading)
5. Creates a stub wiki page for each core source doc

This handles the initial vector indexing. Claude then enriches the wiki pages with summaries and cross-links during Phase 2.

> **Windows note:** `seed.py` must normalize line endings to `\n` when reading markdown files for chunking. Windows `\r\n` line endings can produce inconsistent embeddings for identical text content.

---

## 10. Resource Requirements

| Resource | Phase 1 (all-MiniLM) | Phase 2 (nomic-embed) |
|----------|---------------------|----------------------|
| **RAM** | ~512MB (Python + ChromaDB + model) | ~1GB (larger model) |
| **Disk** | ~500MB (Docker image) + ~80MB (model cache) + vault size | +300MB (nomic model) |
| **CPU** | Any modern CPU, embedding is fast | Same, slightly slower |
| **GPU** | Not required | Not required |
| **Startup time** | ~5 seconds | ~10 seconds |
| **Embedding speed** | ~100 chunks/sec on CPU | ~50 chunks/sec on CPU |

The full kijo docs (~55K lines) would produce roughly 500-800 chunks. Initial indexing takes under 10 seconds on Phase 1.

---

## 11. Phase Plan

### Phase 1 — MVP (Week 1)
**Goal:** Working MCP server with read/write/search on a seeded wiki.

Deliverables:
- FastMCP server with 8 tools (Section 7)
- ChromaDB embedded with default all-MiniLM-L6-v2
- Docker container + compose file
- SCHEMA.md + wiki conventions
- Migration of kijo core docs (6 files) to raw/ and initial wiki pages
- Claude MCP config entry

**Done when:** Claude can `search_wiki("what did we decide about SLP burn mechanics")` and get a relevant result.

### Phase 2 — Enrichment (Week 2-3)
**Goal:** Full wiki coverage, better embeddings, richer cross-linking.

Deliverables:
- Migrate all 130+ kijo-bonsai docs
- Swap to nomic-embed-text via Ollama sidecar (if retrieval quality needs it)
- **Embedding migration:** Re-embed all existing chunks with nomic-embed-text (768 dims vs 384 dims — cannot mix in the same collection). Back up `.chroma/` before swapping, then drop and recreate the ChromaDB collection.
- Add `lint_wiki` tool (check for broken links, stale pages, orphaned sources)
- Add `link_pages` tool (suggest and create cross-links)
- Obsidian graph view validation

### Phase 3 — Multi-Project & Automation (Month 2+)
**Goal:** Cover all Jeremy's projects, auto-ingest new docs.

Deliverables:
- Migrate axie-wargrounds, TitanAI, The Outlet docs
- File watcher: auto-re-index when raw/ files change (must use **polling** with configurable interval, not inotify — inotify does not work across Docker's 9P/Plan9 mount on Windows WSL2)
- Session hooks: auto-log decisions made during Cowork sessions
- Optional: web clipper to save articles to raw/references/

---

## 12. Assumptions Register

1. **Docker Desktop is running and accessible** — Jeremy has it installed; assumed it can expose port 8200 to localhost for MCP connection. Mitigation: test port binding in Phase 1.

2. **MCP Streamable HTTP transport works with Cowork** — FastMCP Streamable HTTP over HTTP should work, but Cowork's MCP config may only support stdio. Mitigation: FastMCP supports both; if Streamable HTTP fails, wrap in a stdio bridge or use `docker exec` stdio mode.

3. **ChromaDB embedded mode is stable in Docker** — ChromaDB's embedded mode with persistent storage on a volume mount should survive container restarts. Mitigation: test persistence across restarts in Phase 1.

4. **all-MiniLM-L6-v2 is sufficient for ~500 chunks** — At this scale, even a weak embedding model should produce useful retrieval. Mitigation: Phase 2 upgrades to nomic-embed-text if results are poor.

5. **Obsidian can open the vault while Docker has it mounted** — Both read the same files; no locking conflicts expected with markdown. Mitigation: Obsidian is read-only viewer; Claude is the only writer.

---

## 13. Open Questions

1. **Where should `second-brain/` live?** — **RESOLVED:** `playground/second-brain/`
   (inside Jeremy's connected Cowork playground folder). Jeremy explicitly chose this
   location for easy Cowork access and co-location with project repos.

2. **Should raw/ contain copies or symlinks?** Copies are safer (no broken links if projects move), but duplicate data. Recommendation: copies for core docs, with a note of the original path in frontmatter.

3. **Git-track the wiki?** The vault could be its own git repo for version history. Recommendation: yes, with `.chroma/` in `.gitignore`.

4. **How aggressive should auto-ingest be?** Should every new ARCH-*/AUDIT-* doc in the pipeline automatically become a wiki page? Recommendation: yes for raw/ indexing, but wiki page creation should be Claude-initiated (human-in-the-loop on what gets summarized).

5. **Multi-user?** Currently single-user (Jeremy). No auth needed on the MCP server. If this changes, add API key auth to FastMCP.

---

## 14. Cross-Reference Check

```
CROSS-REFERENCE CHECK
  checked against:
    - Karpathy LLM Wiki gist (structure, operations, conventions)
    - Existing kijo docs structure (file names, locations, count)
    - Kijo terminology canon (from CLAUDE.md / verified-architect skill)
  consistent: yes
    - Wiki structure follows Karpathy's raw/wiki/index.md/log.md pattern
    - Page types (concept, decision, pattern, entity, lesson) cover existing doc types
    - All kijo terminology in examples uses canonical forms
  terminology aligned: yes
    - kijonsai (lowercase), kijo (lowercase), SLP = Soothing Leaf Potion / Smooth Love Potion
    - Flower Guild Rank, species names, technique names all canonical
  boundary violations: none
```

---

## 15. Code Source Audits

```
CODE SOURCE AUDIT — FastMCP Docker pattern
  snippet:     Dockerfile + docker-compose.yml for FastMCP Streamable HTTP server
  origin:      Synthesized from multiple 2026 tutorials (freecodecamp, firecrawl, medium)
  license:     N/A (patterns, not copied code)
  version:     FastMCP 3.4+ + Python 3.12
  current:     Yes, FastMCP 3.4.6 as of Aug 2026, actively maintained
  assumptions: Port 8200 is available, volume mounts work on Windows Docker Desktop
  limitations: No TLS, no auth (single-user local deployment)
  adaptation:  Will need actual requirements.txt and server code written
  verdict:     ADAPT — patterns are sound, implementation must be written

CODE SOURCE AUDIT — ChromaDB embedded mode
  snippet:     ChromaDB used in-process with persistent storage
  origin:      ChromaDB official docs (docs.trychroma.com)
  license:     Apache-2.0
  version:     ChromaDB latest (2026)
  current:     Yes
  assumptions: Persistent directory survives container restarts when volume-mounted
  limitations: Single-process, no concurrent writers (fine for single-user)
  adaptation:  Standard usage, no adaptation needed
  verdict:     USE AS-IS
```

---

## Sources

- [Karpathy LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [Karpathy's LLM Wiki: A Knowledge Base That Compounds](https://www.aibuilderclub.com/blog/karpathy-llm-wiki)
- [16 Million Views for a Folder Structure](https://www.remio.ai/post/andrej-karpathy-published-an-llm-wiki-pattern-16-million-views-for-a-folder-structure)
- [Best Ollama Embedding Models 2026](https://www.morphllm.com/ollama-embedding-models)
- [Best Local Embedding Models for RAG 2026](https://d-central.tech/local-embedding-models/)
- [ChromaDB Embedding Functions Docs](https://docs.trychroma.com/docs/embeddings/embedding-functions)
- [How to Run ChromaDB in Docker](https://oneuptime.com/blog/post/2026-02-08-how-to-run-chromadb-in-docker-for-embeddings/view)
- [Vector Database Comparison 2026](https://encore.dev/articles/best-vector-databases)
- [ChromaDB vs Qdrant](https://www.kunalganglani.com/blog/qdrant-vs-chroma)
- [FastMCP Tutorial](https://www.firecrawl.dev/blog/fastmcp-tutorial-building-mcp-servers-python)
- [Deploy MCP Server with Docker](https://mcpize.com/blog/deploy-mcp-docker)
- [vault-mcp (GitHub)](https://github.com/robbiemu/vault-mcp)
- [MCP-Markdown-RAG (GitHub)](https://github.com/Zackriya-Solutions/MCP-Markdown-RAG)
- [obsidian-mcp (GitHub)](https://github.com/StevenStavrakis/obsidian-mcp)
- [knowledge-base-server (GitHub)](https://github.com/willynikes2/knowledge-base-server)
