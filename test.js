/* eslint-env mocha */

'use strict'

const fs = require('fs')
const path = require('path')
const assert = require('assert')
const lodepng = require('lodepng')

const decodeIco = require('./')

const testCases = [
  {
    name: 'facebook',
    images: [{ type: 'bmp', width: 16, height: 16 }]
  },
  {
    name: 'github',
    images: [{ type: 'bmp', width: 16, height: 16 }, { type: 'bmp', width: 32, height: 32 }]
  },
  {
    name: 'google',
    images: [{ type: 'bmp', width: 16, height: 16 }, { type: 'bmp', width: 32, height: 32 }]
  },
  {
    name: 'twitter',
    images: [{ type: 'png', width: 32, height: 32 }]
  }
]

function loadIco (name) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(__dirname, 'fixtures', `${name}.ico`), (err, data) => {
      if (err) return reject(err)

      resolve(decodeIco(data))
    })
  })
}

function loadPng (name) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(__dirname, 'fixtures', `${name}.png`), (err, data) => {
      if (err) return reject(err)

      lodepng.decode(data, (err, result) => {
        if (err) return reject(err)

        resolve(result)
      })
    })
  })
}

describe('Decode ICO', () => {
  for (const testCase of testCases) {
    it(`Decodes ${testCase.name}.ico`, () => {
      return Promise.all([
        loadIco(testCase.name),
        loadPng(testCase.name)
      ], (files) => {
        for (const img of testCase.images) {
          assert(files[0].some(i => i.width === img.width && i.height === img.height), `Contains the size ${img.width}x${img.height}`)
        }

        assert.deepEqual(files[0][0], files[1])
      })
    })
  }
})
