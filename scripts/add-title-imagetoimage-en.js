const fs = require('fs')

const filePath = 'src/renderer/src/i18n/locales/en-us.json'
const content = fs.readFileSync(filePath, 'utf-8')
const data = JSON.parse(content)

// 在 title 对象中添加 imagetoimage 键
if (data.title && typeof data.title === 'object') {
  // 在 "translate": "Translate" 之后添加
  const titleEntries = Object.entries(data.title)
  const newEntries = {}

  for (const [key, value] of titleEntries) {
    newEntries[key] = value
    if (key === 'translate') {
      newEntries['imagetoimage'] = 'Text to Image'
    }
  }

  data.title = newEntries
  console.log('✅ Added title.imagetoimage = "Text to Image"')
  console.log('\n📝 Updated title object:')
  console.log(JSON.stringify(data.title, null, 2))
} else {
  console.log('❌ title object not found')
  process.exit(1)
}

// Write back to file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log('✅ Successfully updated en-us.json')
