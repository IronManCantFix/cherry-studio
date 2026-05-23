import type { FileMetadata, Provider } from '@renderer/types'
import type { TFunction } from 'i18next'
import { isEmpty } from 'lodash'

export function getPaintingProviderPath(providerId: string): string {
  return `/paintings/${encodeURIComponent(providerId)}`
}

export function decodePaintingProviderId(providerId: string): string {
  try {
    return decodeURIComponent(providerId)
  } catch {
    return providerId
  }
}

export function getPaintingProviderIdFromPathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const paintingsIndex = segments.findIndex((segment) => segment === 'paintings')
  const providerId = paintingsIndex === -1 ? segments[segments.length - 1] : segments[paintingsIndex + 1]
  return decodePaintingProviderId(providerId || 'new-api')
}

export function checkProviderEnabled(provider: Provider, t: TFunction): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (provider.enabled && !isEmpty(provider.apiKey)) {
      resolve(true)
      return
    }

    window.modal.warning({
      content: provider.apiKey ? t('error.no_api_key') : t('error.provider_disabled'),
      centered: true,
      closable: true,
      okText: t('common.go_to_settings'),
      onOk: () => {
        window.navigate?.(`/settings/provider?id=${provider.id}`)
        reject('Provider disabled')
      },
      onCancel: () => reject('Provider disabled')
    })
  })
}

export function findPaintingByFiles<T extends { providerId?: string; files: ReadonlyArray<Pick<FileMetadata, 'id'>> }>(
  paintings: ReadonlyArray<T>,
  providerId: string,
  files: ReadonlyArray<Pick<FileMetadata, 'id'>>
): T | undefined {
  return paintings.find(
    (painting) =>
      painting.providerId === providerId &&
      painting.files.length === files.length &&
      painting.files.every((file, index) => file.id === files[index]?.id)
  )
}
