import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import AssistantSidebar from './components/AssistantSidebar'
import ImageGenerationArea from './components/ImageGenerationArea'
import SessionSidebar from './components/SessionSidebar'
import { ImageToImageProvider, useImageToImage } from './store/context'

const ImageToImageContent = () => {
  const { t, i18n } = useTranslation()
  const { resourcesPath } = useRuntime()
  const { state, dispatch } = useImageToImage()

  // 记录已处理的助手和会话，防止重复更新
  const processedRef = useRef<Set<string>>(new Set())
  const defaultPromptLoadedRef = useRef(false)

  useEffect(() => {
    // 为所有助手设置国际化名称和默认提示词
    let needsUpdate = false
    const updates: Record<string, any> = {}

    state.assistants.forEach((assistant) => {
      const assistantUpdates: Record<string, any> = {}
      const assistantKey = `${assistant.id}_names`

      // 更新助手名称（检查是否已处理）
      if (
        !processedRef.current.has(assistantKey) &&
        (assistant.name === '默认助手' || assistant.name === 'Default Assistant')
      ) {
        assistantUpdates.name = t('imagetoimage.defaultAssistantName')
        needsUpdate = true
        processedRef.current.add(assistantKey)
      }

      // 更新话题名称
      const updatedSessions = assistant.sessions.map((session) => {
        const sessionKey = `${assistant.id}_${session.id}_name`
        if (
          !processedRef.current.has(sessionKey) &&
          (session.name === '默认话题' || session.name === 'Default Topic')
        ) {
          processedRef.current.add(sessionKey)
          needsUpdate = true
          return { ...session, name: t('imagetoimage.defaultTopicName') }
        }
        return session
      })

      // 检查会话名称是否需要更新
      const needsSessionUpdate = updatedSessions.some((s, i) => s.name !== assistant.sessions[i].name)
      if (needsSessionUpdate) {
        assistantUpdates.sessions = updatedSessions
      }

      if (Object.keys(assistantUpdates).length > 0) {
        updates[assistant.id] = assistantUpdates
      }
    })

    // 批量更新所有需要更新的助手
    if (needsUpdate) {
      Object.entries(updates).forEach(([id, assistantUpdates]) => {
        dispatch({
          type: 'UPDATE_ASSISTANT',
          payload: { id, updates: assistantUpdates }
        })
      })
    }
  }, [state.assistants, dispatch, t])

  // 从 agents 文件加载默认提示词
  useEffect(() => {
    if (!resourcesPath || defaultPromptLoadedRef.current) return

    const loadDefaultPrompt = async () => {
      try {
        const language = i18n.language
        const fileName = language === 'zh-CN' ? 'agents-zh.json' : 'agents-en.json'
        const agentsData = await window.api.fs.read(`${resourcesPath}/data/${fileName}`, 'utf-8')
        const agents = JSON.parse(agentsData)
        // 查找 id=788 的智能体（英文版本是 788_en）
        const agentId = language === 'zh-CN' ? '788' : '788_en'
        const agent = agents.find((a: any) => a.id === agentId)

        if (agent?.prompt) {
          const defaultAssistant = state.assistants.find((a) => a.id === state.activeAssistantId)
          if (defaultAssistant && !defaultAssistant.prompt) {
            defaultPromptLoadedRef.current = true
            dispatch({
              type: 'UPDATE_ASSISTANT',
              payload: { id: defaultAssistant.id, updates: { prompt: agent.prompt } }
            })
          }
        }
      } catch (error) {
        console.error('Failed to load default assistant prompt:', error)
      }
    }

    loadDefaultPrompt()
  }, [resourcesPath, state.assistants, state.activeAssistantId, dispatch, i18n.language])

  return (
    <>
      <AssistantSidebar />
      <SessionSidebar />
      <ImageGenerationArea />
    </>
  )
}

const ImageToImagePage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <ImageToImageProvider>
      <Container>
        <Navbar>
          <NavbarCenter style={{ borderRight: 'none' }}>{t('imagetoimage.title')}</NavbarCenter>
        </Navbar>
        <ContentContainer>
          <ImageToImageContent />
        </ContentContainer>
      </Container>
    </ImageToImageProvider>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  height: 100%;
  background-color: var(--color-background);
  overflow: hidden;
`

export default ImageToImagePage
