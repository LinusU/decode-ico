/* eslint-env mocha */

'use strict'

const fs = require('fs')
const path = require('path')
const assert = require('assert')

const globby = require('globby')
const lodepng = require('lodepng')

const decodeIco = require('./')

const testCases = globby.sync('fixtures/*.ico')

function decodePng (data) {
  return new Promise((resolve, reject) => {
    lodepng.decode(data, (err, result) => {
      if (err) return reject(err)

      resolve(result)
    })
  })
}

function loadPng (filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, data) => {
      if (err) return reject(err)

      resolve(decodePng(data))
    })
  })
}

for (const testCase of testCases) {
  const name = path.basename(testCase, '.ico')
  const source = fs.readFileSync(testCase)

  describe(`Decoding of ${name}.ico`, () => {
    const targetPaths = globby.sync(`fixtures/${name}-*.png`)

    let result
    it('decodes the source', () => {
      result = decodeIco(source)
    })

    for (let idx = 0; idx < targetPaths.length; idx++) {
      it(`extracts image #${idx}`, () => {
        const actual = result[idx]

        return loadPng(targetPaths[idx]).then((expected) => {
          assert.strictEqual(actual.width, expected.width)
          assert.strictEqual(actual.height, expected.height)

          const imageData = (actual.type === 'png')
            ? decodePng(actual.data)
            : Promise.resolve(actual)

          return imageData.then((imageData) => {
            assert.strictEqual(imageData.data.length, expected.data.length, 'The decoded data should match the target data (length)')
            assert.ok(Buffer.compare(imageData.data, expected.data) === 0, 'The decoded data should match the target data (bytes)')
          })
        })
      })
    }
  })
}
