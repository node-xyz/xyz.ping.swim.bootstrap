const test = require('./../common').test
const expect = require('chai').expect
const _send = test.sendMessage

let processes
let identifiers = []
let TESTER
let lastValue
before(function (done) {
  test.setUpTestEnv((p) => {
    processes = p
    identifiers = Object.keys(processes)
    TESTER = test.getTester()
    done()
  })
})

it('initial state', function (done) {
  done()
})

after(function () {
  for (let p in processes) {
    processes[p].kill()
  }
})
