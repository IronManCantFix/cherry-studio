import { loggerService } from '@logger'
import i18n from 'i18next'
import JSZip from 'jszip'

import type { ImageToImageAssistant, ImageToImageRecord } from './store/types'

const logger = loggerService.withContext('ImageExport')

/**
 * Get a unique folder name by appending _1, _2, etc. if the name is already used.
 */
function getUniqueFolderName(baseName: string, usedNames: Set<string>): string {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName)
    return baseName
  }
  let i = 1
  while (usedNames.has(`${baseName}_${i}`)) {
    i++
  }
  const unique = `${baseName}_${i}`
  usedNames.add(unique)
  return unique
}

/**
 * Sanitize folder/file name: remove characters not safe for file systems.
 */
function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unnamed'
}

/**
 * Trigger a browser download for a Blob with the given filename.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Convert a data: URL directly to a Blob without using fetch.
 * This is more reliable than fetch for large base64 data URLs.
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIndex = dataUrl.indexOf(',')
    if (commaIndex === -1) return null

    const header = dataUrl.substring(0, commaIndex)
    const base64Data = dataUrl.substring(commaIndex + 1)

    const mimeMatch = header.match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/png'

    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return new Blob([bytes], { type: mime })
  } catch (err) {
    logger.error('Failed to convert data URL to Blob', err as Error)
    return null
  }
}

/**
 * Fetch an image from an HTTP(S) URL and return it as a Blob.
 * First tries fetch in the renderer, then falls back to downloading
 * through the Electron main process (no CORS restrictions).
 */
async function fetchHttpImageAsBlob(url: string): Promise<Blob | null> {
  // Try fetch first (works when webSecurity is false or CORS is allowed)
  try {
    const response = await fetch(url)
    if (response.ok) {
      return await response.blob()
    }
    logger.warn(`fetch returned ${response.status} for URL: ${url.substring(0, 100)}`)
  } catch (err) {
    logger.warn('fetch failed for URL, trying main process fallback', err as Error)
  }

  // Fallback: download through Electron main process (no CORS)
  try {
    const metadata = await window.api.file.download(url, true)
    if (metadata?.name) {
      const { base64, mime } = await window.api.file.base64Image(metadata.name)
      if (base64) {
        const binaryString = atob(base64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return new Blob([bytes], { type: mime || 'image/png' })
      }
    }
  } catch (err) {
    logger.error('Main process download also failed for URL', err as Error)
  }

  return null
}

/**
 * Fetch an image from a URL and return it as a Blob.
 * Handles data: URLs, HTTP(S) URLs, and blob: URLs.
 */
async function fetchImageAsBlob(url: string): Promise<Blob | null> {
  try {
    if (!url) return null

    // Data URLs: convert directly (most reliable, no network)
    if (url.startsWith('data:')) {
      return dataUrlToBlob(url)
    }

    // HTTP(S) URLs: try fetch, then main process fallback
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return await fetchHttpImageAsBlob(url)
    }

    // blob: URLs: use fetch
    if (url.startsWith('blob:')) {
      const response = await fetch(url)
      if (response.ok) {
        return await response.blob()
      }
      return null
    }

    logger.warn(`Unsupported image URL scheme: ${url.substring(0, 30)}`)
    return null
  } catch (err) {
    logger.error('fetchImageAsBlob failed', err as Error)
    return null
  }
}

/**
 * Get file extension from a data URL mime type or URL path.
 */
function getImageExtension(url: string): string {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:image\/(\w+);/)
    if (match) return match[1] === 'jpeg' ? 'jpg' : match[1]
  }
  return 'png'
}

/**
 * Export all images for a single session as a zip.
 * Folder structure: {sessionName}/001.png, 002.png, ...
 */
export async function exportSessionImages(sessionName: string, records: ImageToImageRecord[]): Promise<void> {
  const zip = new JSZip()
  let totalImages = 0
  let failedImages = 0

  for (const record of records) {
    const images = record.generatedImageUrls
    if (images.length === 0) continue

    for (const imageUrl of images) {
      if (!imageUrl) continue
      const blob = await fetchImageAsBlob(imageUrl)
      if (blob) {
        const ext = getImageExtension(imageUrl)
        const fileName = `${String(totalImages + 1).padStart(3, '0')}.${ext}`
        zip.file(fileName, blob)
        totalImages++
      } else {
        failedImages++
        logger.warn(`Failed to fetch image: ${imageUrl.substring(0, 80)}...`)
      }
    }
  }

  if (totalImages === 0) {
    if (failedImages > 0) {
      window.toast.warning(i18n.t('imagetoimage.export_images_failed', { count: failedImages }))
    } else {
      window.toast.warning(i18n.t('imagetoimage.no_images_to_export'))
    }
    return
  }

  const name = sanitizeName(sessionName)
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, `${name}.zip`)
  logger.info(`Exported ${totalImages} images for session: ${sessionName}`)

  if (failedImages > 0) {
    window.toast.warning(
      i18n.t('imagetoimage.export_partial_warning', {
        total: totalImages + failedImages,
        failed: failedImages
      })
    )
  }
}

/**
 * Export all images for an assistant (multiple sessions) as a zip.
 * Folder structure: {assistantName}/{sessionName}/001.png, {sessionName_2}/001.png, ...
 * If session names collide, append _1, _2, etc.
 */
export async function exportAssistantImages(
  assistant: ImageToImageAssistant,
  allRecords: ImageToImageRecord[]
): Promise<void> {
  const zip = new JSZip()
  let totalImages = 0
  let failedImages = 0
  const usedFolderNames = new Set<string>()

  for (const session of assistant.sessions) {
    const sessionRecords = allRecords.filter((r) => r.sessionId === session.id)
    const sessionImages = sessionRecords.flatMap((r) => r.generatedImageUrls).filter(Boolean)
    if (sessionImages.length === 0) continue

    const folderName = getUniqueFolderName(sanitizeName(session.name), usedFolderNames)
    const folder = zip.folder(folderName)!

    for (let i = 0; i < sessionImages.length; i++) {
      const blob = await fetchImageAsBlob(sessionImages[i])
      if (blob) {
        const ext = getImageExtension(sessionImages[i])
        folder.file(`${String(i + 1).padStart(3, '0')}.${ext}`, blob)
        totalImages++
      } else {
        failedImages++
        logger.warn(`Failed to fetch image: ${sessionImages[i].substring(0, 80)}...`)
      }
    }
  }

  if (totalImages === 0) {
    if (failedImages > 0) {
      window.toast.warning(i18n.t('imagetoimage.export_images_failed', { count: failedImages }))
    } else {
      window.toast.warning(i18n.t('imagetoimage.no_images_to_export'))
    }
    return
  }

  const name = sanitizeName(assistant.name)
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, `${name}.zip`)
  logger.info(`Exported ${totalImages} images for assistant: ${assistant.name}`)

  if (failedImages > 0) {
    window.toast.warning(
      i18n.t('imagetoimage.export_partial_warning', {
        total: totalImages + failedImages,
        failed: failedImages
      })
    )
  }
}
