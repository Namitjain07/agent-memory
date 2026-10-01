---
"agent-memory": patch
"agent-memory-sqlite": patch
"agent-memory-postgres": patch
"agent-memory-react": patch
"agent-memory-vercel": patch
"agent-memory-cli": patch
---

Round 2 of SEO + ranking improvements. New files in the repo:

- `.github/FUNDING.yml` — GitHub Sponsors link
- `.github/dependabot.yml` — weekly dependency updates
- `.github/release.yml` — categorised changelog for releases
- `.github/workflows/codeql.yml` — CodeQL security scanning (TS + JS)
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.github/workflows/labeler.yml` + `.github/labeler.yml` — auto-label PRs by area
- `.well-known/security.txt` — security contact metadata
- `docs/ARCHITECTURE.md` — module map, data flow, concurrency model
- `docs/COMPARISON.md` — vs. mem0, LangChain Memory, LlamaIndex
- `docs/README.md` — index of documentation
- Expanded `CONTRIBUTING.md` (full dev setup, Changesets workflow, coding conventions)
- Expanded `SECURITY.md` (supported versions table, disclosure timeline, scope)
- Expanded `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1)

Repo-level settings updated via API:

- Description: "Persistent long-term memory for LLM agents and AI chatbots. Hybrid vector + BM25 search, multi-tier scoping, encryption, retries, OpenAI/Anthropic/Vercel AI SDK support, and zero runtime deps."
- Homepage: https://github.com/Namitjain07/agent-memory#readme
- 24 topics: ai, ai-agent, ai-memory, agent, agent-memory, anthropic, chatbot, chatbot-memory, claude, embedding, gpt, llm, llm-agent, llm-memory, long-term-memory, memory, openai, pgvector, rag, semantic-search, typescript, vector-database, vector-search, vercel-ai-sdk
- Delete branch on merge: enabled
