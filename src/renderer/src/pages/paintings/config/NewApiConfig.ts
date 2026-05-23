import type { GeneratePainting } from '@renderer/types'
import { uuid } from '@renderer/utils'

export const SUPPORTED_MODELS = ['gpt-image-1', 'dall-e-3', 'dall-e-2']

export const MODELS = [
  {
    name: 'gpt-image-1',
    group: 'OpenAI',
    imageSizes: [{ value: 'auto' }, { value: '1024x1024' }, { value: '1536x1024' }, { value: '1024x1536' }],
    max_images: 10,
    quality: [{ value: 'auto' }, { value: 'high' }, { value: 'medium' }, { value: 'low' }],
    moderation: [{ value: 'auto' }, { value: 'low' }],
    output_compression_format: [{ value: 'jpeg' }, { value: 'webp' }],
    output_format: [{ value: 'image/png' }, { value: 'image/jpeg' }, { value: 'image/webp' }],
    background: [{ value: 'auto' }, { value: 'transparent' }, { value: 'opaque' }]
  },
  {
    name: 'dall-e-3',
    group: 'OpenAI',
    imageSizes: [{ value: '1024x1024' }, { value: '1792x1024' }, { value: '1024x1792' }],
    max_images: 1,
    quality: [{ value: 'standard' }, { value: 'hd' }],
    moderation: [],
    output_compression_format: [],
    output_format: [],
    background: []
  },
  {
    name: 'dall-e-2',
    group: 'OpenAI',
    imageSizes: [{ value: '256x256' }, { value: '512x512' }, { value: '1024x1024' }],
    max_images: 10,
    quality: [],
    moderation: [],
    output_compression_format: [],
    output_format: [],
    background: []
  }
]

export const DEFAULT_PAINTING: GeneratePainting = {
  id: uuid(),
  urls: [],
  files: [],
  model: '',
  prompt: '',
  quality: 'auto',
  n: 1,
  background: 'auto',
  moderation: 'auto',
  size: 'auto'
}
