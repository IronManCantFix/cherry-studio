import { describe, expect, it } from 'vitest'

import { findPaintingByFiles, getPaintingProviderIdFromPathname, getPaintingProviderPath } from '../index'

describe('findPaintingByFiles', () => {
  const createPainting = (id: string, providerId: string, fileIds: string[]) => ({
    id,
    providerId,
    files: fileIds.map((fileId) => ({ id: fileId }))
  })

  it('returns a painting with the same provider and file order', () => {
    const paintings = [
      createPainting('1', 'provider-a', ['file-1', 'file-2']),
      createPainting('2', 'provider-a', ['file-3'])
    ]

    expect(findPaintingByFiles(paintings, 'provider-a', [{ id: 'file-1' }, { id: 'file-2' }])).toMatchObject({
      id: '1'
    })
  })

  it('ignores paintings from other providers or different file sequences', () => {
    const paintings = [
      createPainting('1', 'provider-b', ['file-1', 'file-2']),
      createPainting('2', 'provider-a', ['file-2', 'file-1'])
    ]

    expect(findPaintingByFiles(paintings, 'provider-a', [{ id: 'file-1' }, { id: 'file-2' }])).toBeUndefined()
  })
})

describe('painting provider route helpers', () => {
  it('encodes and decodes provider ids used as route segments', () => {
    const providerId = 'openai/custom provider'

    expect(getPaintingProviderPath(providerId)).toBe('/paintings/openai%2Fcustom%20provider')
    expect(getPaintingProviderIdFromPathname('/paintings/openai%2Fcustom%20provider')).toBe(providerId)
  })

  it('falls back to new-api when the pathname has no provider segment', () => {
    expect(getPaintingProviderIdFromPathname('/paintings')).toBe('new-api')
    expect(getPaintingProviderIdFromPathname('/')).toBe('new-api')
  })
})
