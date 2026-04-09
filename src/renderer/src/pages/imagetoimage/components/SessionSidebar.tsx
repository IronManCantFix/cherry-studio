import AddButton from '@renderer/components/AddButton'
import { DeleteIcon, EditIcon } from '@renderer/components/Icons'
import { ProviderAvatar } from '@renderer/components/ProviderAvatar'
import { getModelLogoById } from '@renderer/config/models'
import { useProviders } from '@renderer/hooks/useProvider'
import type { Model } from '@renderer/types'
import { getFancyProviderName } from '@renderer/utils'
import type { MenuProps } from 'antd'
import { Dropdown, Input, Select } from 'antd'
import dayjs from 'dayjs'
import { Download, Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { exportSessionImages } from '../exportImages'
import { useImageToImage } from '../store/context'

const SessionSidebar: React.FC = () => {
  const { state, dispatch } = useImageToImage()
  const { providers } = useProviders()
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null)
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null)

  const activeAssistant = state.assistants.find((a) => a.id === state.activeAssistantId)
  const activeSession = activeAssistant?.sessions.find((s) => s.id === state.activeSessionId)

  const availableProviders = useMemo(() => providers.filter((p) => p.models && p.models.length > 0), [providers])

  const currentProvider = useMemo(
    () =>
      availableProviders.find((p) => p.id === (activeSession?.providerId || activeAssistant?.providerId)) ||
      availableProviders[0],
    [availableProviders, activeSession?.providerId, activeAssistant?.providerId]
  )

  const currentModels = useMemo(() => currentProvider?.models || [], [currentProvider])

  const handleAddSession = useCallback(() => {
    if (!activeAssistant) return
    dispatch({
      type: 'ADD_SESSION',
      payload: { assistantId: activeAssistant.id, name: t('imagetoimage.default_topic') }
    })
  }, [activeAssistant, dispatch, t])

  const handleRename = useCallback(
    (sessionId: string) => {
      if (!editingName.trim() || !activeAssistant) return
      dispatch({
        type: 'UPDATE_SESSION',
        payload: { assistantId: activeAssistant.id, id: sessionId, updates: { name: editingName.trim() } }
      })
      setEditingId(null)
    },
    [editingName, activeAssistant, dispatch]
  )

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      if (!activeAssistant) return
      dispatch({ type: 'REMOVE_SESSION', payload: { assistantId: activeAssistant.id, id: sessionId } })
    },
    [activeAssistant, dispatch]
  )

  const handleExportSession = useCallback(
    async (sessionId: string) => {
      const session = activeAssistant?.sessions.find((s) => s.id === sessionId)
      if (!session) return
      const records = state.records.filter((r) => r.sessionId === sessionId)
      setExportingSessionId(sessionId)
      try {
        await exportSessionImages(session.name, records)
      } finally {
        setExportingSessionId(null)
      }
    },
    [activeAssistant, state.records]
  )

  const handleProviderChange = useCallback(
    (providerId: string) => {
      if (!activeAssistant || !activeSession) return
      const provider = availableProviders.find((p) => p.id === providerId)
      const modelId = provider?.models[0]?.id || ''
      dispatch({
        type: 'UPDATE_SESSION',
        payload: { assistantId: activeAssistant.id, id: activeSession.id, updates: { providerId, modelId } }
      })
    },
    [activeAssistant, activeSession, availableProviders, dispatch]
  )

  const handleModelChange = useCallback(
    (modelId: string) => {
      if (!activeAssistant || !activeSession) return
      dispatch({
        type: 'UPDATE_SESSION',
        payload: { assistantId: activeAssistant.id, id: activeSession.id, updates: { modelId } }
      })
    },
    [activeAssistant, activeSession, dispatch]
  )

  const targetSession = useMemo(
    () => activeAssistant?.sessions.find((s) => s.id === targetSessionId),
    [activeAssistant, targetSessionId]
  )

  const getMenuItems = useMemo(() => {
    if (!targetSession) return []

    const menus: MenuProps['items'] = [
      {
        label: t('common.edit'),
        key: 'rename',
        icon: <EditIcon size={14} />,
        onClick: () => {
          setEditingId(targetSession.id)
          setEditingName(targetSession.name)
        }
      },
      {
        label: t('imagetoimage.export_images'),
        key: 'export',
        icon: exportingSessionId === targetSession.id ? <Loader2 size={14} className="spin" /> : <Download size={14} />,
        disabled: exportingSessionId === targetSession.id,
        onClick: () => void handleExportSession(targetSession.id)
      },
      {
        label: t('imagetoimage.clear_history'),
        key: 'clear',
        onClick: () => dispatch({ type: 'CLEAR_SESSION_RECORDS', payload: { sessionId: targetSession.id } })
      },
      { type: 'divider' },
      {
        label: t('common.delete'),
        danger: true,
        key: 'delete',
        icon: <DeleteIcon size={14} className="lucide-custom" />,
        disabled: (activeAssistant?.sessions.length ?? 0) <= 1,
        onClick: () => handleDeleteSession(targetSession.id)
      }
    ]
    return menus
  }, [targetSession, activeAssistant, handleDeleteSession, handleExportSession, exportingSessionId, dispatch, t])

  const effectiveModelId = activeSession?.modelId || activeAssistant?.modelId || ''
  const effectiveProviderId = activeSession?.providerId || activeAssistant?.providerId || ''

  return (
    <Container>
      <Header>
        <AddButton onClick={handleAddSession}>{t('chat.add.topic.title')}</AddButton>
      </Header>

      <ListWrapper>
        {activeAssistant?.sessions.map((session) => (
          <Dropdown key={session.id} menu={{ items: getMenuItems }} trigger={['contextMenu']}>
            <SessionItem
              $active={session.id === state.activeSessionId}
              onClick={() => dispatch({ type: 'SET_ACTIVE_SESSION', payload: { id: session.id } })}
              onContextMenu={() => setTargetSessionId(session.id)}>
              {editingId === session.id ? (
                <Input
                  size="small"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onPressEnter={() => handleRename(session.id)}
                  onBlur={() => setEditingId(null)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <>
                  <SessionName>{session.name}</SessionName>
                  <SessionTime>{dayjs(session.createdAt).format('YYYY/MM/DD HH:mm')}</SessionTime>
                </>
              )}
            </SessionItem>
          </Dropdown>
        ))}
      </ListWrapper>

      {activeSession && (
        <SettingsArea>
          <Label>{t('common.provider')}</Label>
          <Select
            showSearch
            optionFilterProp="label"
            value={effectiveProviderId || undefined}
            onChange={handleProviderChange}
            style={{ width: '100%', marginBottom: 8 }}
            placeholder={t('imagetoimage.select_provider')}
            options={availableProviders.map((p) => ({
              label: (
                <ProviderOption>
                  <ProviderAvatar provider={p} size={18} />
                  <span>{getFancyProviderName(p)}</span>
                </ProviderOption>
              ),
              value: p.id
            }))}
          />

          <Label>{t('imagetoimage.model')}</Label>
          <Select
            showSearch
            optionFilterProp="label"
            value={effectiveModelId || undefined}
            onChange={handleModelChange}
            style={{ width: '100%' }}
            placeholder={t('imagetoimage.select_model')}
            options={currentModels.map((m: Model) => {
              const logo = getModelLogoById(m.id)
              return {
                label: (
                  <ModelOption>
                    {logo && <ModelLogo src={logo} />}
                    <span>{m.name || m.id}</span>
                  </ModelOption>
                ),
                value: m.id
              }
            })}
          />
        </SettingsArea>
      )}
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: var(--assistants-width);
  height: 100%;
  background-color: var(--color-background-soft);
  border-right: 0.5px solid var(--color-border);
`

const Header = styled.div`
  padding: 12px 10px 8px;
`

const ListWrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 10px;
  flex: 1;
  overflow-y: auto;
`

const SessionItem = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: var(--list-item-border-radius);
  cursor: pointer;
  transition: background-color 0.1s;
  background: ${({ $active }) => ($active ? 'var(--color-list-item)' : 'transparent')};
  box-shadow: ${({ $active }) => ($active ? '0 1px 2px 0 rgba(0,0,0,0.05)' : 'none')};

  &:hover {
    background-color: ${({ $active }) => ($active ? 'var(--color-list-item)' : 'var(--color-list-item-hover)')};
  }
`

const SessionName = styled.span`
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const SessionTime = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
`

const SettingsArea = styled.div`
  padding: 12px;
  border-top: 0.5px solid var(--color-border);
`

const Label = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin-bottom: 4px;
`

const ProviderOption = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const ModelOption = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const ModelLogo = styled.img`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: contain;
`

export default SessionSidebar
