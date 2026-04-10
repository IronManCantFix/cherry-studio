import EmojiIcon from '@renderer/components/EmojiIcon'
import { CopyIcon, DeleteIcon, EditIcon } from '@renderer/components/Icons'
import AddAssistantPopup from '@renderer/components/Popups/AddAssistantPopup'
import PromptPopup from '@renderer/components/Popups/PromptPopup'
import Scrollbar from '@renderer/components/Scrollbar'
import type { MenuProps } from 'antd'
import { Dropdown } from 'antd'
import { BrushCleaning, Download, Loader2, NotebookPen } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { exportAssistantImages } from '../exportImages'
import { useImageToImage } from '../store/context'

const AssistantSidebar: React.FC = () => {
  const { state, dispatch } = useImageToImage()
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)
  const prevAssistantCountRef = useRef(state.assistants.length)
  const [targetAssistantId, setTargetAssistantId] = useState<string | null>(null)
  const [exportingAssistantId, setExportingAssistantId] = useState<string | null>(null)

  useEffect(() => {
    if (state.assistants.length > prevAssistantCountRef.current && listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }
    prevAssistantCountRef.current = state.assistants.length
  }, [state.assistants.length])

  const handleAddAssistant = useCallback(async () => {
    const assistant = await AddAssistantPopup.show()
    if (assistant) {
      dispatch({
        type: 'ADD_ASSISTANT',
        payload: { name: assistant.name, emoji: assistant.emoji || '🎨', prompt: assistant.prompt || '' }
      })
    }
  }, [dispatch])

  const handleDeleteAssistant = useCallback(
    (id: string) => {
      if (state.assistants.length <= 1) return
      window.modal.confirm({
        title: t('assistants.delete.title'),
        content: t('assistants.delete.content'),
        centered: true,
        okButtonProps: { danger: true },
        onOk: () => dispatch({ type: 'REMOVE_ASSISTANT', payload: { id } })
      })
    },
    [state.assistants.length, dispatch, t]
  )

  const handleRenameAssistant = useCallback(
    async (id: string) => {
      const assistant = state.assistants.find((a) => a.id === id)
      if (!assistant) return
      const name = await PromptPopup.show({
        title: t('assistants.edit.title'),
        message: '',
        defaultValue: assistant.name
      })
      if (name && name !== assistant.name) {
        dispatch({ type: 'UPDATE_ASSISTANT', payload: { id, updates: { name: name.trim() } } })
      }
    },
    [state.assistants, dispatch, t]
  )

  const handleEditPrompt = useCallback(
    async (id: string) => {
      const assistant = state.assistants.find((a) => a.id === id)
      if (!assistant) return
      const newPrompt = await PromptPopup.show({
        title: t('imagetoimage.edit_assistant_prompt'),
        message: '',
        defaultValue: assistant.prompt || '',
        inputProps: { rows: 8, allowClear: true }
      })
      if (newPrompt !== null) {
        dispatch({ type: 'UPDATE_ASSISTANT', payload: { id, updates: { prompt: newPrompt.trim() } } })
      }
    },
    [state.assistants, dispatch, t]
  )

  const handleDuplicate = useCallback(
    (id: string) => {
      dispatch({ type: 'DUPLICATE_ASSISTANT', payload: { id } })
    },
    [dispatch]
  )

  const handleClearRecords = useCallback(
    (id: string) => {
      window.modal.confirm({
        title: t('assistants.clear.title'),
        content: t('imagetoimage.clear_all_records_confirm'),
        centered: true,
        okButtonProps: { danger: true },
        onOk: () => dispatch({ type: 'CLEAR_ALL_SESSION_RECORDS', payload: { assistantId: id } })
      })
    },
    [dispatch, t]
  )

  const handleExportAssistant = useCallback(
    async (id: string) => {
      const assistant = state.assistants.find((a) => a.id === id)
      if (!assistant) return
      setExportingAssistantId(id)
      try {
        await exportAssistantImages(assistant, state.records)
      } finally {
        setExportingAssistantId(null)
      }
    },
    [state.assistants, state.records]
  )

  const targetAssistant = useMemo(
    () => state.assistants.find((a) => a.id === targetAssistantId),
    [state.assistants, targetAssistantId]
  )

  const getMenuItems = useMemo(() => {
    if (!targetAssistant) return []

    const menus: MenuProps['items'] = [
      {
        label: t('assistants.edit.title'),
        key: 'edit',
        icon: <EditIcon size={14} />,
        onClick: () => void handleRenameAssistant(targetAssistant.id)
      },
      {
        label: t('imagetoimage.edit_prompt'),
        key: 'prompt',
        icon: <NotebookPen size={14} />,
        onClick: () => void handleEditPrompt(targetAssistant.id)
      },
      {
        label: t('imagetoimage.export_images'),
        key: 'export',
        icon:
          exportingAssistantId === targetAssistant.id ? <Loader2 size={14} className="spin" /> : <Download size={14} />,
        disabled: exportingAssistantId === targetAssistant.id,
        onClick: () => void handleExportAssistant(targetAssistant.id)
      },
      {
        label: t('assistants.copy.title'),
        key: 'duplicate',
        icon: <CopyIcon size={14} />,
        onClick: () => handleDuplicate(targetAssistant.id)
      },
      {
        label: t('assistants.clear.title'),
        key: 'clear',
        icon: <BrushCleaning size={14} />,
        onClick: () => handleClearRecords(targetAssistant.id)
      },
      { type: 'divider' },
      {
        label: t('common.delete'),
        danger: true,
        key: 'delete',
        icon: <DeleteIcon size={14} className="lucide-custom" />,
        disabled: state.assistants.length <= 1,
        onClick: () => handleDeleteAssistant(targetAssistant.id)
      }
    ]
    return menus
  }, [
    targetAssistant,
    handleRenameAssistant,
    handleEditPrompt,
    handleExportAssistant,
    handleDuplicate,
    handleClearRecords,
    handleDeleteAssistant,
    exportingAssistantId,
    state.assistants.length,
    t
  ])

  return (
    <Container>
      <Header>
        <AddButton onClick={handleAddAssistant}>{t('chat.add.assistant.title')}</AddButton>
      </Header>

      <ListWrapper ref={listRef}>
        {state.assistants.map((assistant) => (
          <Dropdown key={assistant.id} menu={{ items: getMenuItems }} trigger={['contextMenu']}>
            <AssistantItem
              $active={assistant.id === state.activeAssistantId}
              onClick={() => dispatch({ type: 'SET_ACTIVE_ASSISTANT', payload: { id: assistant.id } })}
              onContextMenu={() => setTargetAssistantId(assistant.id)}>
              <EmojiIcon emoji={assistant.emoji} />
              <AssistantName>{assistant.name}</AssistantName>
            </AssistantItem>
          </Dropdown>
        ))}
      </ListWrapper>
    </Container>
  )
}

const Container = styled(Scrollbar)`
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

const AddButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border-radius: var(--list-item-border-radius);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-2);
  transition: all 0.2s;

  &:hover {
    background-color: var(--color-background-mute);
    color: var(--color-text-1);
  }
`

const ListWrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 10px;
  flex: 1;
  overflow-y: auto;
`

const AssistantItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
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

const AssistantName = styled.span`
  flex: 1;
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export default AssistantSidebar
