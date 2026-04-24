import { useTheme } from '@renderer/context/ThemeProvider'
import { useVideoService } from '@renderer/hooks/useVideoService'
import type { RootState } from '@renderer/store'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setVideoServiceMacUrl, setVideoServicePort, setVideoServiceWindowsUrl } from '@renderer/store/settings'
import { Button, Input, InputNumber, Typography } from 'antd'
import { Download, Play, Square } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer } from '../..'

const { Title, Text } = Typography

const defaultVideoServiceConfig = {
  enabled: false,
  windowsUrl: 'https://cdn.example.com/video-service/win/video-service.zip',
  macUrl: 'https://cdn.example.com/video-service/mac/video-service.zip',
  port: 7890
}

const VideoServiceSettings: FC = () => {
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const videoServiceConfig =
    useAppSelector((state: RootState) => state.settings.videoService) || defaultVideoServiceConfig
  const { videoServiceRunning, loading, installed, startService, stopService, downloadService } = useVideoService()

  const handleDownload = async () => {
    if (!videoServiceConfig.windowsUrl && !videoServiceConfig.macUrl) {
      window.toast.error(t('videoService.messages.noDownloadUrl'))
      return
    }
    const success = await downloadService()
    if (success) {
      window.toast.success(t('videoService.messages.downloadSuccess'))
    } else {
      window.toast.error(t('videoService.messages.downloadFailed'))
    }
  }

  const handleStart = async () => {
    const success = await startService()
    if (success) {
      window.toast.success(t('videoService.messages.startSuccess'))
    } else {
      window.toast.error(t('videoService.messages.startFailed'))
    }
  }

  const handleStop = async () => {
    const success = await stopService()
    if (success) {
      window.toast.success(t('videoService.messages.stopSuccess'))
    } else {
      window.toast.error(t('videoService.messages.stopFailed'))
    }
  }

  return (
    <Container theme={theme}>
      <HeaderSection>
        <HeaderContent>
          <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
            {t('videoService.title')}
          </Title>
          <Text type="secondary">{t('videoService.description')}</Text>
        </HeaderContent>
      </HeaderSection>

      {/* Download Section */}
      <ConfigSection>
        <FieldLabel>{t('videoService.fields.windowsUrl')}</FieldLabel>
        <StyledInput
          value={videoServiceConfig.windowsUrl}
          onChange={(e) => dispatch(setVideoServiceWindowsUrl(e.target.value))}
          placeholder={t('videoService.fields.windowsUrl.placeholder')}
        />

        <FieldLabel>{t('videoService.fields.macUrl')}</FieldLabel>
        <StyledInput
          value={videoServiceConfig.macUrl}
          onChange={(e) => dispatch(setVideoServiceMacUrl(e.target.value))}
          placeholder={t('videoService.fields.macUrl.placeholder')}
        />

        <FieldLabel>{t('videoService.fields.port')}</FieldLabel>
        <StyledInputNumber
          value={videoServiceConfig.port}
          onChange={(value) => dispatch(setVideoServicePort(typeof value === 'number' ? value : 7890))}
          min={1000}
          max={65535}
        />
      </ConfigSection>

      {/* Control Section */}
      <ControlSection>
        {!installed ? (
          <Button icon={<Download size={14} />} onClick={handleDownload} loading={loading}>
            {t('videoService.actions.download')}
          </Button>
        ) : videoServiceRunning ? (
          <Button icon={<Square size={14} />} onClick={handleStop} loading={loading} danger>
            {t('videoService.actions.stop')}
          </Button>
        ) : (
          <Button icon={<Play size={14} />} onClick={handleStart} loading={loading}>
            {t('videoService.actions.start')}
          </Button>
        )}
      </ControlSection>
    </Container>
  )
}

// Styled components similar to ApiServerSettings
const Container = styled(SettingContainer)`
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--navbar-height));
`

const HeaderSection = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`

const HeaderContent = styled.div`
  flex: 1;
`

const ConfigSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--color-background);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  margin-bottom: 16px;
`

const FieldLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  margin: 0;
`

const StyledInput = styled(Input)`
  width: 100%;
  border-radius: 6px;
  border: 1.5px solid var(--color-border);
`

const StyledInputNumber = styled(InputNumber)`
  width: 120px;
  border-radius: 6px;
  border: 1.5px solid var(--color-border);
`

const ControlSection = styled.div`
  display: flex;
  gap: 12px;
`

export default VideoServiceSettings
