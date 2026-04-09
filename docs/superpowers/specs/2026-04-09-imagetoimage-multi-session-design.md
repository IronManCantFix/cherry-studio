# Image-to-Image Multi-Session Design

## Overview

Refactor the single-session ImageToImagePage to support multiple assistants, each with multiple sessions. Each session maintains independent generation history.

## Data Model

```typescript
interface ImageToImageAssistant {
  id: string
  name: string
  emoji: string
  providerId: string
  modelId: string
  sessions: ImageToImageSession[]
}

interface ImageToImageSession {
  id: string
  name: string
  providerId: string
  modelId: string
  negativePrompt: string
  createdAt: string
  updatedAt: string
}

interface ImageToImageRecord {
  id: string
  sessionId: string
  prompt: string
  inputImageUrls: string[]
  generatedImageUrls: string[]
  providerId: string
  modelId: string
  createdAt: string
}
```

## Architecture

- State: React Context + useReducer (independent from Redux)
- Persistence: localStorage (`imagetoimage-data`)
- All new code under `src/renderer/src/pages/imagetoimage/`

## UI Layout

Three-column layout:
- Left: Assistant list (add/delete/switch)
- Middle: Session list for active assistant (add/delete/rename, per-session model override)
- Right: Generation area with history records

## Existing File Changes

- Router.tsx: no additional changes needed
- i18n files: new keys for session management
- No changes to Redux, Dexie, or BLOCKED files
