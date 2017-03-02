const test = require('./../common').test
const expect = require('chai').expect
const _send = test.sendMessage

let processes
let identifiers = []
let TESTER
const TOTAL = 2
before(function (done) {
  test.setUpTestEnv((p) => {
    processes = p
    identifiers = Object.keys(processes)
    TESTER = test.getTester()
    done()
  }, 'xyz.test.no.join.json')
})

it('initial state', function (done) {
  // TODO: if we find a way to set swim as the ping of admin node, we don't have to wait this long
  setTimeout(() => {
    _send('inspectJSON', processes[identifiers[0]], (data) => {
      expect(data.global.systemConf.nodes.length).to.equal(TOTAL)
      expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL)
      _send('inspectJSON', processes[identifiers[1]], (data) => {
        expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL)
        expect(data.global.systemConf.nodes.length).to.equal(TOTAL)
        done()
      })
    })
  }, 14000)
  this.timeout(15000)
})

it.skip('delete one of them', function (done) {
  done()
})

after(function () {
  for (let p in processes) {
    processes[p].kill()
  }
})
