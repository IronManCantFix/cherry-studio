import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import AssistantSidebar from './components/AssistantSidebar'
import ImageGenerationArea from './components/ImageGenerationArea'
import SessionSidebar from './components/SessionSidebar'
import { ImageToImageProvider } from './store/context'

const ImageToImagePage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <ImageToImageProvider>
      <Container>
        <Navbar>
          <NavbarCenter style={{ borderRight: 'none' }}>{t('imagetoimage.title')}</NavbarCenter>
        </Navbar>
        <ContentContainer>
          <AssistantSidebar />
          <SessionSidebar />
          <ImageGenerationArea />
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
