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
  }

  get (x, y, channel) {
    const idx = this.format.indexOf(channel)

    if (this.depth === 1) {
      const slice = this.data[(y * this.stride) + (x / 8 | 0)]
      const mask = 1 << (7 - (x % 8))

      return (slice & mask) ? 0 : 255
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

function decodeBmp ({ data, width, height }) {
  const headerSize = data.readUInt32LE(0)
  const colorDepth = data.readUInt16LE(14)
  let colorCount = data.readUInt32LE(32)

  if (colorCount === 0 && colorDepth <= 8) {
    colorCount = (1 << colorDepth)
  }

  const xor = new Bitmap(data, headerSize + (colorCount * 4), { width, height, colorDepth, format: 'BGRA' })
  const and = new Bitmap(data, xor.offset + xor.size, { width, height, colorDepth: 1, format: 'A' })

  const result = Buffer.alloc(width * height * 4)
  const hasAlphaChannel = (colorDepth === 32)

  if (colorDepth === 32 || colorDepth === 24) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[((y * height) + x) * 4 + 0] = xor.get(x, height - y - 1, 'R')
        result[((y * height) + x) * 4 + 1] = xor.get(x, height - y - 1, 'G')
        result[((y * height) + x) * 4 + 2] = xor.get(x, height - y - 1, 'B')
        result[((y * height) + x) * 4 + 3] = (hasAlphaChannel ? xor : and).get(x, height - y - 1, 'A')
      }
    }
  } else {
    throw new Error(`A color depth of ${colorDepth} is currently not supported`)
  }

  return { width, height, data: result }
}

module.exports = function decodeIco (_input) {
  // input = Buffer.isBuffer(input) ? input : Buffer.from(input)
  const input = Buffer.from(_input)

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
