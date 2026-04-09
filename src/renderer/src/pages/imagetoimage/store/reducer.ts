import { uuid } from '@renderer/utils'

import type { ImageToImageAssistant, ImageToImageRecord, ImageToImageSession, ImageToImageState } from './types'

const STORAGE_KEY = 'imagetoimage-data'

export function loadState(): ImageToImageState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const state = JSON.parse(raw) as ImageToImageState
      // Migration: ensure new fields exist on older data
      for (const assistant of state.assistants) {
        if (assistant.prompt === undefined) {
          assistant.prompt = ''
        }
        for (const session of assistant.sessions) {
          if (session.imageN === undefined) session.imageN = 1
          if (session.imageSize === undefined) session.imageSize = '1024x1024'
          if (session.imageQuality === undefined) session.imageQuality = 'auto'
          if (session.imageResponseFormat === undefined) session.imageResponseFormat = 'b64_json'
        }
      }
      return state
    }
  } catch {
    // ignore
  }
  return createInitialState()
}

export function saveState(state: ImageToImageState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

function createInitialState(): ImageToImageState {
  const defaultSession = createSession('默认话题')
  const defaultAssistant = createAssistant('默认助手', '🎨', defaultSession)
  return {
    assistants: [defaultAssistant],
    activeAssistantId: defaultAssistant.id,
    activeSessionId: defaultSession.id,
    records: []
  }
}

export function createAssistant(name: string, emoji: string, session?: ImageToImageSession): ImageToImageAssistant {
  const firstSession = session || createSession('默认话题')
  return {
    id: uuid(),
    name,
    emoji,
    prompt: '',
    providerId: '',
    modelId: '',
    sessions: [firstSession]
  }
}

export function createSession(name: string): ImageToImageSession {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    name,
    providerId: '',
    modelId: '',
    negativePrompt: '',
    imageN: 1,
    imageSize: '1024x1024',
    imageQuality: 'auto',
    imageResponseFormat: 'b64_json',
    createdAt: now,
    updatedAt: now
  }
}

export function createRecord(
  sessionId: string,
  prompt: string,
  inputImageUrls: string[],
  generatedImageUrls: string[],
  providerId: string,
  modelId: string,
  createdAt: string,
  completedAt: string
): ImageToImageRecord {
  return {
    id: uuid(),
    sessionId,
    prompt,
    inputImageUrls,
    generatedImageUrls,
    providerId,
    modelId,
    createdAt,
    completedAt
  }
}

// Actions
type Action =
  | { type: 'ADD_ASSISTANT'; payload: { name: string; emoji: string; prompt?: string } }
  | { type: 'REMOVE_ASSISTANT'; payload: { id: string } }
  | { type: 'DUPLICATE_ASSISTANT'; payload: { id: string } }
  | { type: 'SET_ACTIVE_ASSISTANT'; payload: { id: string } }
  | { type: 'UPDATE_ASSISTANT'; payload: { id: string; updates: Partial<ImageToImageAssistant> } }
  | { type: 'ADD_SESSION'; payload: { assistantId: string; name: string } }
  | { type: 'REMOVE_SESSION'; payload: { assistantId: string; id: string } }
  | { type: 'SET_ACTIVE_SESSION'; payload: { id: string } }
  | { type: 'UPDATE_SESSION'; payload: { assistantId: string; id: string; updates: Partial<ImageToImageSession> } }
  | { type: 'ADD_RECORD'; payload: ImageToImageRecord }
  | { type: 'REMOVE_RECORD'; payload: { id: string } }
  | { type: 'CLEAR_SESSION_RECORDS'; payload: { sessionId: string } }
  | { type: 'CLEAR_ALL_SESSION_RECORDS'; payload: { assistantId: string } }

export function reducer(state: ImageToImageState, action: Action): ImageToImageState {
  switch (action.type) {
    case 'ADD_ASSISTANT': {
      const session = createSession('默认话题')
      const assistant = createAssistant(action.payload.name, action.payload.emoji, session)
      assistant.prompt = action.payload.prompt || ''
      return {
        ...state,
        assistants: [...state.assistants, assistant],
        activeAssistantId: assistant.id,
        activeSessionId: session.id
      }
    }

    case 'REMOVE_ASSISTANT': {
      if (state.assistants.length <= 1) return state
      const remaining = state.assistants.filter((a) => a.id !== action.payload.id)
      const sessionIds = state.assistants.find((a) => a.id === action.payload.id)?.sessions.map((s) => s.id) || []
      const isActive = state.activeAssistantId === action.payload.id
      return {
        ...state,
        assistants: remaining,
        activeAssistantId: isActive ? remaining[0].id : state.activeAssistantId,
        activeSessionId: isActive ? remaining[0].sessions[0]?.id || '' : state.activeSessionId,
        records: state.records.filter((r) => !sessionIds.includes(r.sessionId))
      }
    }

    case 'DUPLICATE_ASSISTANT': {
      const source = state.assistants.find((a) => a.id === action.payload.id)
      if (!source) return state
      const newSession = createSession('默认话题')
      const newAssistant = createAssistant(`${source.name} (copy)`, source.emoji, newSession)
      newAssistant.prompt = source.prompt
      return {
        ...state,
        assistants: [...state.assistants, newAssistant],
        activeAssistantId: newAssistant.id,
        activeSessionId: newSession.id
      }
    }

    case 'SET_ACTIVE_ASSISTANT': {
      const assistant = state.assistants.find((a) => a.id === action.payload.id)
      if (!assistant) return state
      return {
        ...state,
        activeAssistantId: assistant.id,
        activeSessionId: assistant.sessions[0]?.id || ''
      }
    }

    case 'UPDATE_ASSISTANT': {
      return {
        ...state,
        assistants: state.assistants.map((a) => (a.id === action.payload.id ? { ...a, ...action.payload.updates } : a))
      }
    }

    case 'ADD_SESSION': {
      const session = createSession(action.payload.name)
      return {
        ...state,
        assistants: state.assistants.map((a) =>
          a.id === action.payload.assistantId ? { ...a, sessions: [...a.sessions, session] } : a
        ),
        activeSessionId: session.id
      }
    }

    case 'REMOVE_SESSION': {
      return {
        ...state,
        assistants: state.assistants.map((a) => {
          if (a.id !== action.payload.assistantId) return a
          if (a.sessions.length <= 1) return a
          return { ...a, sessions: a.sessions.filter((s) => s.id !== action.payload.id) }
        }),
        activeSessionId:
          state.activeSessionId === action.payload.id
            ? state.assistants
                .find((a) => a.id === action.payload.assistantId)
                ?.sessions.find((s) => s.id !== action.payload.id)?.id || ''
            : state.activeSessionId,
        records: state.records.filter((r) => r.sessionId !== action.payload.id)
      }
    }

    case 'SET_ACTIVE_SESSION': {
      return { ...state, activeSessionId: action.payload.id }
    }

    case 'UPDATE_SESSION': {
      return {
        ...state,
        assistants: state.assistants.map((a) =>
          a.id === action.payload.assistantId
            ? {
                ...a,
                sessions: a.sessions.map((s) => (s.id === action.payload.id ? { ...s, ...action.payload.updates } : s))
              }
            : a
        )
      }
    }

    case 'ADD_RECORD': {
      // Update session updatedAt
      const sessionId = action.payload.sessionId
      return {
        ...state,
        records: [action.payload, ...state.records],
        assistants: state.assistants.map((a) => ({
          ...a,
          sessions: a.sessions.map((s) => (s.id === sessionId ? { ...s, updatedAt: new Date().toISOString() } : s))
        }))
      }
    }

    case 'REMOVE_RECORD': {
      return { ...state, records: state.records.filter((r) => r.id !== action.payload.id) }
    }

    case 'CLEAR_SESSION_RECORDS': {
      return { ...state, records: state.records.filter((r) => r.sessionId !== action.payload.sessionId) }
    }

    case 'CLEAR_ALL_SESSION_RECORDS': {
      const sessionIds = new Set(
        state.assistants.find((a) => a.id === action.payload.assistantId)?.sessions.map((s) => s.id) || []
      )
      return { ...state, records: state.records.filter((r) => !sessionIds.has(r.sessionId)) }
    }

    default:
      return state
  }
}
