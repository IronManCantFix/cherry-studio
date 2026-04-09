const fs = require('fs')

// 读取 zh-cn.json 文件
const zhCnPath = 'src/renderer/src/i18n/locales/zh-cn.json'
const enUsPath = 'src/renderer/src/i18n/locales/en-us.json'

const zhCnContent = fs.readFileSync(zhCnPath, 'utf-8')
const enUsContent = fs.readFileSync(enUsPath, 'utf-8')

const zhCnData = JSON.parse(zhCnContent)
const enUsData = JSON.parse(enUsContent)

// 添加 launchpad.imagetoimage 翻译
if (zhCnData.launchpad && typeof zhCnData.launchpad === 'object') {
  enUsData.launchpad.imagetoimage = 'Text to Image'
  console.log('✅ 添加了 launchpad.imagetoimage')
} else {
  console.log('❌ 未找到 launchpad 对象')
}

// 添加 imagetoimage 对象
enUsData.imagetoimage = {
  title: 'Text to Image',
  subtitle: 'Connect to domestic AI image generation APIs',
  platforms: {
    jimeng: {
      name: 'Jimeng',
      description: 'Text to image models, various styles'
    },
    volcengine: {
      name: 'Volcengine',
      description: 'Volcengine image generation models'
    },
    aliyun: {
      name: 'Aliyun',
      description: 'Aliyun image generation service'
    }
  },
  platform_section: {
    title: 'Select Platform',
    subtitle: 'Choose image generation platform'
  },
  prompt_section: {
    title: 'Prompt',
    placeholder: 'Describe of image you want, e.g., A cute little cat...',
    negative_prompt: 'Negative prompt (optional)',
    negative_placeholder: "Content you don't want, e.g., blurry, low quality..."
  },
  generate_button: 'Generate Image',
  history_section: {
    title: 'Generation History',
    empty: 'No generation records yet. Click generate to start creating.'
  }
}

// 写回文件
fs.writeFileSync(enUsPath, JSON.stringify(enUsData, null, 2) + '\n', 'utf-8')
console.log('✅ 成功添加 imagetoimage 翻译到 en-us.json')
console.log('\n📝 添加的翻译键：')
console.log('  launchpad.imagetoimage = "Text to Image"')
console.log('  imagetoimage.* (完整对象)')
