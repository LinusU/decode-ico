const fs = require('fs')
const lodepng = require('lodepng')

const decodeIco = require('../')

const source = fs.readFileSync(process.argv[2])
const images = decodeIco(source)

for (const image of images) {
  const postfix = `-${image.width}x${image.height}.png`

  if (image.type === 'png') {
    fs.writeFile(`${process.argv[3]}${postfix}`, image.data, (err) => {
      if (err) throw err
    })

    continue
  }

  lodepng.encode(image, (err, data) => {
    if (err) throw err

    fs.writeFile(`${process.argv[3]}${postfix}`, data, (err) => {
      if (err) throw err
    })
  })
}
