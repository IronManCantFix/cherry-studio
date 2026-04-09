import {
  CopyOutlined,
  DownloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { download } from '@renderer/utils/download'
import { convertImageToPng } from '@renderer/utils/image'
import { parseDataUrl } from '@shared/utils'
import { Image as AntImage } from 'antd'
import { Base64 } from 'js-base64'
import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('ImageGalleryPreview')

interface ImageGalleryPreviewProps {
  /** All image URLs in the gallery, must match the DOM order of Image components */
  imageUrls: string[]
  children: React.ReactNode
}

/**
 * Wraps multiple AntImage components to provide a grouped preview with:
 * - Previous/Next navigation arrows
 * - A thumbnail bar at the bottom
 * - Zoom, rotate, flip, copy, download controls
 */
const ImageGalleryPreview: React.FC<ImageGalleryPreviewProps> = ({ imageUrls, children }) => {
  const { t } = useTranslation()
  const [previewState, setPreviewState] = useState({ visible: false, current: 0 })
  const currentRef = useRef(0)
  currentRef.current = previewState.current

  const handleCopyImage = useCallback(
    async (src: string) => {
      try {
        let blob: Blob

        if (src.startsWith('data:')) {
          const parseResult = parseDataUrl(src)
          if (!parseResult?.mediaType || !parseResult.isBase64) {
            throw new Error('Invalid base64 image format')
          }
          const byteArray = Base64.toUint8Array(parseResult.data)
          blob = new Blob([byteArray.slice()], { type: parseResult.mediaType })
        } else {
          const response = await fetch(src)
          blob = await response.blob()
        }

        const pngBlob = await convertImageToPng(blob)
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
        window.toast.success(t('message.copy.success'))
      } catch (error) {
        logger.error('Failed to copy image', error as Error)
        window.toast.error(t('message.copy.failed'))
      }
    },
    [t]
  )

  const navigateTo = useCallback((index: number) => {
    setPreviewState((prev) => ({ ...prev, current: index }))
  }, [])

  if (imageUrls.length === 0) return <>{children}</>

  return (
    <AntImage.PreviewGroup
      preview={{
        visible: previewState.visible,
        current: previewState.current,
        onVisibleChange: (visible: boolean, _prevValue: boolean, current: number) => {
          setPreviewState({ visible, current })
        },
        onChange: (current) => {
          setPreviewState((prev) => ({ ...prev, current }))
        },
        toolbarRender: (
          _,
          {
            transform: { scale },
            actions: { onFlipY, onFlipX, onRotateLeft, onRotateRight, onZoomOut, onZoomIn, onReset }
          }
        ) => (
          <PreviewToolbarContainer>
            <ToolbarRow>
              <SwapOutlined rotate={90} onClick={onFlipY} />
              <SwapOutlined onClick={onFlipX} />
              <RotateLeftOutlined onClick={onRotateLeft} />
              <RotateRightOutlined onClick={onRotateRight} />
              <ZoomOutOutlined disabled={scale === 1} onClick={onZoomOut} />
              <ZoomInOutlined disabled={scale === 50} onClick={onZoomIn} />
              <UndoOutlined onClick={onReset} />
              <ToolbarDivider />
              <CopyOutlined onClick={() => void handleCopyImage(imageUrls[currentRef.current])} />
              <DownloadOutlined onClick={() => download(imageUrls[currentRef.current])} />
            </ToolbarRow>
            {imageUrls.length > 1 && (
              <ThumbnailBar>
                <ThumbnailScroll>
                  {imageUrls.map((url, idx) => (
                    <ThumbnailItem key={idx} $active={idx === currentRef.current} onClick={() => navigateTo(idx)}>
                      <img src={url} alt={`thumbnail ${idx + 1}`} />
                    </ThumbnailItem>
                  ))}
                </ThumbnailScroll>
              </ThumbnailBar>
            )}
          </PreviewToolbarContainer>
        )
      }}>
      {children}
    </AntImage.PreviewGroup>
  )
}

const PreviewToolbarContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0 24px;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 100px;
`

const ToolbarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  font-size: 18px;
  padding: 4px 0;

  .anticon {
    padding: 10px;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .anticon:hover {
    opacity: 0.3;
  }

  .anticon[disabled] {
    opacity: 0.3;
    cursor: not-allowed;
  }
`

const ToolbarDivider = styled.div`
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.3);
  margin: 0 4px;
`

const ThumbnailBar = styled.div`
  width: 100%;
  padding: 0 8px 8px;
`

const ThumbnailScroll = styled.div`
  display: flex;
  gap: 6px;
  overflow-x: auto;
  justify-content: center;
  padding: 4px 0;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }
`

const ThumbnailItem = styled.div<{ $active: boolean }>`
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid ${({ $active }) => ($active ? 'var(--color-primary, #1677ff)' : 'transparent')};
  opacity: ${({ $active }) => ($active ? 1 : 0.5)};
  transition: all 0.2s;

  &:hover {
    opacity: 1;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export default ImageGalleryPreview
