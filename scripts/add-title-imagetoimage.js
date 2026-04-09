const fs = require('fs')

const filePath = 'src/renderer/src/i18n/locales/zh-cn.json'
const content = fs.readFileSync(filePath, 'utf-8')
const data = JSON.parse(content)

// 在 title 对象中添加 imagetoimage 键
if (data.title && typeof data.title === 'object') {
  // 在 "translate": "翻译" 之后添加
  const titleEntries = Object.entries(data.title)
  const newEntries = {}

  for (const [key, value] of titleEntries) {
    newEntries[key] = value
    if (key === 'translate') {
      newEntries['imagetoimage'] = '图生图'
    }
  }

  data.title = newEntries
  console.log('✅ 添加了 title.imagetoimage = "图生图"')
  console.log('\n📝 更新后的 title 对象：')
  console.log(JSON.stringify(data.title, null, 2))
} else {
  console.log('❌ 未找到 title 对象')
  process.exit(1)
}

// 写回文件
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log('✅ 成功更新 zh-cn.json')
