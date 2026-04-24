import { useTheme } from '@renderer/context/ThemeProvider'
import { useVideoService } from '@renderer/hooks/useVideoService'
import type { RootState } from '@renderer/store'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setVideoServiceMacUrl, setVideoServiceWindowsUrl } from '@renderer/store/settings'
import { Button, Input, Progress, Tooltip, Typography } from 'antd'
import { Download, FolderOpen, Play, RefreshCw, RotateCcw, Settings, Square } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer } from '../..'

const { Title, Text } = Typography

const defaultVideoServiceConfig = {
  enabled: false,
  windowsUrl: 'https://huangjia.pw:8888/s/download/6a5f592a85d7406887?token=b72f2a61a5d9cd229c436f1bb3406ad0',
  macUrl: 'https://huangjia.pw:8888/s/download/6a5f592a85d7406887?token=b72f2a61a5d9cd229c436f1bb3406ad0',
  port: 8501
}

const VideoServiceSettings: FC = () => {
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const videoServiceConfig =
    useAppSelector((state: RootState) => state.settings.videoService) || defaultVideoServiceConfig
  const downloadState = useAppSelector((state: RootState) => state.runtime.videoServiceDownload)
  const {
    videoServiceRunning,
    loading,
    installed,
    startService,
    stopService,
    downloadService,
    updateService,
    openFolder,
    updateModelConfig
  } = useVideoService()

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

  const handleRestart = async () => {
    await stopService()
    const success = await startService()
    if (success) {
      window.toast.success(t('videoService.messages.startSuccess'))
    } else {
      window.toast.error(t('videoService.messages.startFailed'))
    }
  }

  const handleUpdate = async () => {
    if (!videoServiceConfig.windowsUrl && !videoServiceConfig.macUrl) {
      window.toast.error(t('videoService.messages.noDownloadUrl'))
      return
    }
    const success = await updateService()
    if (success) {
      window.toast.success(t('videoService.messages.updateSuccess'))
    } else {
      window.toast.error(t('videoService.messages.updateFailed'))
    }
  }

  const handleOpenFolder = () => {
    openFolder()
  }

  const handleUpdateModelConfig = async () => {
    const success = await updateModelConfig()
    if (success) {
      window.toast.success(t('videoService.messages.updateModelConfigSuccess'))
    } else {
      window.toast.error(t('videoService.messages.updateModelConfigFailed'))
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

      {/* Server Control Panel */}
      {installed && (
        <ServerControlPanel $status={videoServiceRunning}>
          <StatusSection>
            <StatusIndicator $status={videoServiceRunning} />
            <StatusContent>
              <StatusText $status={videoServiceRunning}>
                {videoServiceRunning ? t('videoService.status.running') : t('videoService.status.stopped')}
              </StatusText>
              <StatusSubtext>
                {videoServiceRunning ? 'http://127.0.0.1:8501' : t('videoService.fields.port')}
              </StatusSubtext>
            </StatusContent>
          </StatusSection>
          <ControlButtons>
            {videoServiceRunning && (
              <Tooltip title={t('videoService.actions.restart')}>
                <ActionButton $loading={loading} onClick={loading ? undefined : handleRestart}>
                  <RotateCcw size={14} />
                  <span>{t('videoService.actions.restart')}</span>
                </ActionButton>
              </Tooltip>
            )}
            <Tooltip title={videoServiceRunning ? t('videoService.actions.stop') : t('videoService.actions.start')}>
              {videoServiceRunning ? (
                <StopStartButton $loading={loading} onClick={loading ? undefined : handleStop}>
                  <Square size={20} style={{ color: 'var(--color-status-error)' }} />
                </StopStartButton>
              ) : (
                <StopStartButton $loading={loading} onClick={loading ? undefined : handleStart}>
                  <Play size={20} style={{ color: 'var(--color-status-success)' }} />
                </StopStartButton>
              )}
            </Tooltip>
          </ControlButtons>
        </ServerControlPanel>
      )}

      {/* Download Section */}
      <ConfigSection>
        <FieldLabel>
          {navigator.platform.includes('Mac') ? t('videoService.fields.macUrl') : t('videoService.fields.windowsUrl')}
        </FieldLabel>
        <StyledInput
          value={navigator.platform.includes('Mac') ? videoServiceConfig.macUrl : videoServiceConfig.windowsUrl}
          onChange={(e) => {
            const value = e.target.value
            if (navigator.platform.includes('Mac')) {
              dispatch(setVideoServiceMacUrl(value))
            } else {
              dispatch(setVideoServiceWindowsUrl(value))
            }
          }}
        />
      </ConfigSection>

      {/* Download Progress */}
      {downloadState.loading && (
        <ProgressWrapper>
          <Progress
            percent={downloadState.progress}
            status={downloadState.progress < 100 ? 'active' : 'success'}
            size="small"
          />
          <ProgressStatusText type="secondary">
            {downloadState.status === 'downloading' && t('videoService.status.downloading')}
            {downloadState.status === 'extracting' && t('videoService.status.extracting')}
            {downloadState.status === 'cleaning' && t('videoService.status.cleaning')}
            {downloadState.status === 'done' && t('videoService.status.done')}
          </ProgressStatusText>
        </ProgressWrapper>
      )}

      {/* Action Buttons */}
      {!installed ? (
        <Button icon={<Download size={14} />} onClick={handleDownload} loading={loading}>
          {t('videoService.actions.download')}
        </Button>
      ) : (
        <ButtonRow>
          <Button icon={<RefreshCw size={14} />} onClick={handleUpdate} loading={loading}>
            {t('videoService.actions.update')}
          </Button>
          <Button icon={<FolderOpen size={14} />} onClick={handleOpenFolder}>
            {t('videoService.actions.openFolder')}
          </Button>
          <Button icon={<Settings size={14} />} onClick={handleUpdateModelConfig}>
            {t('videoService.actions.updateModelConfig')}
          </Button>
        </ButtonRow>
      )}
    </Container>
  )
}

// Styled Components
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

const ServerControlPanel = styled.div<{ $status: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-radius: 8px;
  background: var(--color-background);
  border: 1px solid ${(props) => (props.$status ? 'var(--color-status-success)' : 'var(--color-border)')};
  transition: all 0.3s ease;
  margin-bottom: 16px;
`

const StatusSection = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const StatusIndicator = styled.div<{ $status: boolean }>`
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(props) => (props.$status ? 'var(--color-status-success)' : 'var(--color-status-error)')};

  &::before {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: ${(props) => (props.$status ? 'var(--color-status-success)' : 'var(--color-status-error)')};
    opacity: 0.2;
    animation: ${(props) => (props.$status ? 'pulse 2s infinite' : 'none')};
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.2;
    }
    50% {
      transform: scale(1.5);
      opacity: 0.1;
    }
  }
`

const StatusContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const StatusText = styled.div<{ $status: boolean }>`
  font-weight: 600;
  font-size: 14px;
  color: ${(props) => (props.$status ? 'var(--color-status-success)' : 'var(--color-text-1)')};
`

const StatusSubtext = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const ControlButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const ActionButton = styled.div<{ $loading: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-2);
  cursor: ${(props) => (props.$loading ? 'not-allowed' : 'pointer')};
  opacity: ${(props) => (props.$loading ? 0.5 : 1)};
  font-size: 12px;
  transition: all 0.2s ease;

  &:hover {
    color: ${(props) => (props.$loading ? 'var(--color-text-2)' : 'var(--color-primary)')};
  }
`

const StopStartButton = styled.div<{ $loading: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: ${(props) => (props.$loading ? 'not-allowed' : 'pointer')};
  opacity: ${(props) => (props.$loading ? 0.5 : 1)};
  transition: all 0.2s ease;

  &:hover {
    transform: ${(props) => (props.$loading ? 'scale(1)' : 'scale(1.1)')};
  }
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
`

const StyledInput = styled(Input)`
  width: 100%;
  border-radius: 6px;
  border: 1.5px solid var(--color-border);
`

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 12px;
`

const ProgressWrapper = styled.div`
  width: 100%;
  margin-bottom: 12px;
`

const ProgressStatusText = styled(Text)`
  font-size: 12px;
`

export default VideoServiceSettings
