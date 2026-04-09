const fs = require('fs')

const filePath = 'src/renderer/src/i18n/locales/zh-cn.json'
const content = fs.readFileSync(filePath, 'utf-8')
const data = JSON.parse(content)

// 添加 launchpad.imagetoimage
if (data.launchpad && typeof data.launchpad === 'object') {
  data.launchpad.imagetoimage = '图生图'
  console.log('✅ 添加了 launchpad.imagetoimage')
} else {
  console.log('❌ 未找到 launchpad 对象')
  process.exit(1)
}

// 添加 imagetoimage 对象
data.imagetoimage = {
  title: '图生图',
  subtitle: '对接国内 AI 图生图接口',
  platforms: {
    jimeng: {
      name: '即梦',
      description: '文生图模型，支持多种风格'
    },
    volcengine: {
      name: '火山引擎',
      description: '火山引擎图生图模型'
    },
    aliyun: {
      name: '阿里云',
      description: '阿里云图生图服务'
    }
  },
  platform_section: {
    title: '选择平台',
    subtitle: '选择图生图平台'
  },
  prompt_section: {
    title: '提示词',
    placeholder: '描述你想要的图片，例如：一只可爱的小猫...',
    negative_prompt: '负向提示词（可选）',
    negative_placeholder: '不想要的内容，例如：模糊、低质量...'
  },
  generate_button: '生成图片',
  history_section: {
    title: '生成历史',
    empty: '暂无生成记录，点击生成按钮开始创作'
  }
}

// 写回文件
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log('✅ 成功添加 imagetoimage 翻译到 zh-cn.json')
console.log('\n📝 添加的翻译键：')
console.log('  launchpad.imagetoimage = "图生图"')
console.log('  imagetoimage.* (完整对象)')
