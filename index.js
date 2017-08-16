function makeDivisibleByFour (input) {
  const rest = input % 4

  return rest ? input + 4 - rest : input
}

class Bitmap {
  constructor (data, offset, { width, height, colorDepth, format }) {
    this.format = format
    this.offset = offset
    this.depth = colorDepth
    this.stride = makeDivisibleByFour(width * this.depth / 8)
    this.size = (this.stride * height)
    this.data = data.slice(this.offset, this.offset + this.size)

    if (this.size !== this.data.byteLength) {
      throw new Error('Truncated bitmap data')
    }
  }

  get (x, y, channel) {
    const idx = this.format.indexOf(channel)

    if (this.depth === 1) {
      const slice = this.data[(y * this.stride) + (x / 8 | 0)]
      const mask = 1 << (7 - (x % 8) * 1)

      return (slice & mask) >> (7 - (x % 8) * 1)
    }

    if (this.depth === 2) {
      const slice = this.data[(y * this.stride) + (x / 4 | 0)]
      const mask = 3 << (6 - (x % 4) * 2)

      return (slice & mask) >>> (6 - (x % 4) * 2)
    }

    if (this.depth === 4) {
      const slice = this.data[(y * this.stride) + (x / 2 | 0)]
      const mask = 15 << (4 - (x % 2) * 4)

      return (slice & mask) >>> (4 - (x % 2) * 4)
    }

    return this.data[(y * this.stride) + (x * (this.depth / 8)) + idx]
  }
}

function isPng (data, offset) {
  return (
    data[offset + 0] === 137 &&
    data[offset + 1] === 80 &&
    data[offset + 2] === 78 &&
    data[offset + 3] === 71 &&
    data[offset + 4] === 13 &&
    data[offset + 5] === 10 &&
    data[offset + 6] === 26 &&
    data[offset + 7] === 10
  )
}

function decodeTrueColorBmp (data, offset, { width, height, colorDepth }) {
  if (colorDepth !== 32 && colorDepth !== 24) {
    throw new Error(`A color depth of ${colorDepth} is not supported`)
  }

  const xor = new Bitmap(data, offset, { width, height, colorDepth, format: 'BGRA' })
  const and = new Bitmap(data, xor.offset + xor.size, { width, height, colorDepth: 1, format: 'A' })

  const result = Buffer.alloc(width * height * 4)

  let idx = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      result[idx++] = xor.get(x, height - y - 1, 'R')
      result[idx++] = xor.get(x, height - y - 1, 'G')
      result[idx++] = xor.get(x, height - y - 1, 'B')

      if (colorDepth === 32) {
        result[idx++] = xor.get(x, height - y - 1, 'A')
      } else {
        result[idx++] = and.get(x, height - y - 1, 'A') ? 0 : 255
      }
    }
  }

  return result
}

function decodePaletteBmp (data, offset, { width, height, colorDepth, colorCount }) {
  if (colorDepth !== 8 && colorDepth !== 4 && colorDepth !== 2 && colorDepth !== 1) {
    throw new Error(`A color depth of ${colorDepth} is not supported`)
  }

  const colors = new Bitmap(data, offset, { width: colorCount, height: 1, colorDepth: 32, format: 'BGRA' })
  const xor = new Bitmap(data, colors.offset + colors.size, { width, height, colorDepth, format: 'C' })
  const and = new Bitmap(data, xor.offset + xor.size, { width, height, colorDepth: 1, format: 'A' })

  const result = Buffer.alloc(width * height * 4)

  let idx = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colorIndex = xor.get(x, height - y - 1, 'C')

      result[idx++] = colors.get(colorIndex, 0, 'R')
      result[idx++] = colors.get(colorIndex, 0, 'G')
      result[idx++] = colors.get(colorIndex, 0, 'B')
      result[idx++] = and.get(x, height - y - 1, 'A') ? 0 : 255
    }
  }

  return result
}

function decodeBmp ({ data, width, height }) {
  const headerSize = data.readUInt32LE(0)
  const colorDepth = data.readUInt16LE(14)
  let colorCount = data.readUInt32LE(32)

  if (colorCount === 0 && colorDepth <= 8) {
    colorCount = (1 << colorDepth)
  }

  const result = colorCount
    ? decodePaletteBmp(data, headerSize, { width, height, colorDepth, colorCount })
    : decodeTrueColorBmp(data, headerSize, { width, height, colorDepth })

  return { width, height, data: result }
}

module.exports = function decodeIco (input) {
  input = Buffer.isBuffer(input) ? input : Buffer.from(input)

  if (input.byteLength < 6) {
    throw new Error('Truncated header')
  }

  if (input.readUInt16LE(0, true) !== 0) {
    throw new Error('Invalid magic bytes')
  }

  if (input.readUInt16LE(2, true) !== 1) {
    throw new Error('Invalid magic bytes')
  }

  const length = input.readUInt16LE(4, true)

  if (input.byteLength < 6 + (16 * length)) {
    throw new Error('Truncated image list')
  }

  return Array.from({ length }, (_, idx) => {
    const width = input.readUInt8(6 + (16 * idx) + 0, true)
    const height = input.readUInt8(6 + (16 * idx) + 1, true)
    // const nColors = input.readUInt8(6 + (16 * idx) + 2, true)
    // const reserved = input.readUInt8(6 + (16 * idx) + 3, true)
    // const nPlanes = input.readUInt16LE(6 + (16 * idx) + 4, true)
    // const colorDepth = input.readUInt16LE(6 + (16 * idx) + 6, true)
    const size = input.readUInt32LE(6 + (16 * idx) + 8, true)
    const offset = input.readUInt32LE(6 + (16 * idx) + 12, true)
    const data = input.slice(offset, offset + size)

    if (isPng(input, offset)) {
      return {
        data,
        height,
        type: 'png',
        width
      }
    }

    const bmp = decodeBmp({ data, width, height })

    return {
      data: bmp.data,
      height: bmp.height,
      type: 'bmp',
      width: bmp.width
    }

    // const header = Buffer.allocUnsafe(14)

    // const dibHeaderSize = data.readUInt32LE(0)

    // header.write('BM', 0, 2)
    // header.writeUInt32LE(14 + data.byteLength, 2, true)
    // header.writeUInt16LE(0, 6, true)
    // header.writeUInt16LE(0, 8, true)
    // header.writeUInt32LE(14 + dibHeaderSize, 10, true)

    // return {
    //   width: (width === 0 ? 256 : width),
    //   height: (height === 0 ? 256 : height),
    //   nColors,
    //   reserved,
    //   nPlanes,
    //   colorDepth,
    //   size,
    //   offset,
    //   // header,
    //   stuff,
    //   data
    // }
  })
}
