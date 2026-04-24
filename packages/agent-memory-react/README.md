# @namitjain.india/agent-memory-react

[![npm version](https://img.shields.io/npm/v/@namitjain.india/agent-memory-react)](https://www.npmjs.com/package/@namitjain.india/agent-memory-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/Namitjain07/agent-memory?style=social)](https://github.com/Namitjain07/agent-memory/stargazers)

React hook utilities for [@namitjain.india/agent-memory](https://www.npmjs.com/package/@namitjain.india/agent-memory). Provides easy stateful integration with React applications.

[GitHub](https://github.com/Namitjain07/agent-memory) | [Report Bug](https://github.com/Namitjain07/agent-memory/issues) | [Request Feature](https://github.com/Namitjain07/agent-memory/issues)

## Installation

```bash
npm install @namitjain.india/agent-memory-react react
```

## Usage

```tsx
import { useMemory } from "@namitjain.india/agent-memory-react";

function Chat() {
  const {
    messages,
    setMessages,
    remember,
    recall,
    forget,
    inject,
    memory
  } = useMemory("user-123", {
    embedding: {
      embedFn: async (text) => [text.length / 100, 0.5]
    }
  });

  const onUserMessage = async (content: string) => {
    // Remember the user message
    await remember({ role: "user", content });

    // Recall relevant memories
    const context = await recall(content, { topK: 4 });

    // Inject context into messages and send to LLM
    const enhancedMessages = await inject([
      ...messages,
      { role: "user", content }
    ], { query: content });

    // ... send to LLM and get response
  };

  return (
    <div>
      <p>Messages: {messages.length}</p>
      <p>Memory items: {(await memory.getBySession()).length}</p>
    </div>
  );
}
```

## useMemory

```tsx
const result = useMemory(sessionId, options);
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | Unique session identifier |
| `options` | `UseMemoryOptions` | Configuration options |

### Options

Extends `AgentMemoryOptions` from the core package, with these additions:

| Option | Type | Description |
|--------|------|-------------|
| `memory` | `AgentMemory` | Provide custom AgentMemory instance |
| `initialMessages` | `MemoryMessage[]` | Initial messages array |

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `MemoryMessage[]` | Current message state |
| `setMessages` | `Dispatch<SetStateAction<MemoryMessage[]>>` | Set messages directly |
| `remember` | `(input) => Promise<MemoryItem>` | Store a memory |
| `recall` | `(query, options?) => Promise<RecallResult[]>` | Retrieve memories |
| `forget` | `(id: string) => Promise<void>` | Delete a memory |
| `inject` | `(messages, options?) => Promise<MemoryMessage[]>` | Inject memories into messages |
| `memory` | `AgentMemory` | Direct access to AgentMemory instance |

### remember

Store memories. Automatically updates the messages array for entries.

```tsx
// Store conversation entry
await remember({
  role: "user",
  content: "Hello!",
  importance: 0.8
});

// Store a fact
await remember({
  kind: "fact",
  key: "preferred_language",
  value: "TypeScript"
});
```

### recall

Retrieve relevant memories using semantic search.

```tsx
const results = await recall("What do I prefer?", {
  topK: 3,
  kinds: ["entry", "fact"]
});
```

### forget

Delete a memory by ID.

```tsx
await forget("memory-entry-id");
```

### inject

Inject retrieved memories as a system message.

```tsx
const enhanced = await inject(currentMessages, {
  query: "last message content",
  topK: 3
});
```

### Direct Memory Access

For advanced use cases, access the underlying AgentMemory instance:

```tsx
const { memory } = useMemory("session-1");

// Call any AgentMemory method directly
await memory.summarise({ sessionId: "session-1" });
const allMemories = await memory.getBySession();
```

## Example: Complete Chat Component

```tsx
import { useState } from "react";
import { useMemory } from "@namitjain.india/agent-memory-react";

export function Chat() {
  const [input, setInput] = useState("");
  const { messages, remember, recall, inject, memory } = useMemory("chat-1", {
    embedding: { embedFn: async (t) => [t.length / 100] }
  });

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Store user message
    await remember({ role: "user", content: input });

    // Inject context and prepare for LLM
    const withContext = await inject(
      [...messages, { role: "user", content: input }],
      { topK: 5 }
    );

    // Simulate LLM call
    const response = "I remember you prefer TypeScript!";

    // Store assistant response
    await remember({ role: "assistant", content: response });

    setInput("");
  };

  return (
    <div>
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={m.role}>
            {m.content}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

## Requirements

- React >= 18.0.0 or React >= 19.0.0
- @namitjain.india/agent-memory >= 0.1.0

## Contributing & Collaboration

We welcome contributions, feedback, and feature requests!

- **Bug Reports**: [Open an issue](https://github.com/Namitjain07/agent-memory/issues)
- **Feature Requests**: [Share it](https://github.com/Namitjain07/agent-memory/issues)
- **Pull Requests**: [Submit a PR](https://github.com/Namitjain07/agent-memory/pulls)

If this project helps you, please consider [starring it on GitHub](https://github.com/Namitjain07/agent-memory)!

## License

MIT