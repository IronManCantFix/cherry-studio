import { useVideoService } from '@renderer/hooks/useVideoService'
import type { FC } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

const VideoPage: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { videoServiceRunning, getServiceUrl } = useVideoService()

  useEffect(() => {
    if (!videoServiceRunning) {
      // 如果服务未运行，可以选择导航回启动台或显示提示
      navigate('/launchpad')
    }
  }, [videoServiceRunning, navigate])

  const serviceUrl = getServiceUrl()

  return (
    <Container>
      <WebViewContainer>
        {videoServiceRunning ? (
          <webview
            src={serviceUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            partition="persist:video-service"
          />
        ) : (
          <LoadingContainer>
            <Text>{t('videoService.status.notRunning')}</Text>
          </LoadingContainer>
        )}
      </WebViewContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: calc(100vh - var(--navbar-height));
  background: var(--color-background);
`

const WebViewContainer = styled.div`
  flex: 1;
  width: 100%;
  position: relative;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--color-text-2);
`

const Text = styled.div`
  font-size: 14px;
  color: var(--color-text-2);
`

export default VideoPage
