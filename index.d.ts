declare interface Hotspot {
  x: number
  y: number
}

declare interface ImageData {
  bpp: number
  data: Uint8Array
  height: number
  hotspot: Hotspot | null
  type: 'bmp' | 'png'
  width: number
}

declare function decodeIco (source: ArrayBuffer | Int8Array | Uint8Array | Uint8ClampedArray): ImageData[]

export = decodeIco
