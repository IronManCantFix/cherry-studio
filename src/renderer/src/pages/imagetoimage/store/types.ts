export interface ImageToImageAssistant {
  id: string
  name: string
  emoji: string
  prompt: string
  providerId: string
  modelId: string
  sessions: ImageToImageSession[]
}

export interface ImageToImageSession {
  id: string
  name: string
  providerId: string
  modelId: string
  negativePrompt: string
  /** Number of images to generate (1-10) */
  imageN: number
  /** Output size, e.g. '1024x1024' */
  imageSize: string
  /** Rendering quality: 'low' | 'medium' | 'high' | 'auto' */
  imageQuality: string
  /** Response format: 'b64_json' | 'url' */
  imageResponseFormat: string
  createdAt: string
  updatedAt: string
}

export interface ImageToImageRecord {
  id: string
  sessionId: string
  prompt: string
  inputImageUrls: string[]
  generatedImageUrls: string[]
  providerId: string
  modelId: string
  createdAt: string
  completedAt: string
}

export interface ImageToImageState {
  assistants: ImageToImageAssistant[]
  activeAssistantId: string
  activeSessionId: string
  records: ImageToImageRecord[]
}
