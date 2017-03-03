const test = require('./../common').test
const expect = require('chai').expect
const _send = test.sendMessage

let processes
let identifiers = []
let TESTER
const TOTAL = 1 + 3
before(function (done) {
  this.timeout(16000)
  test.setUpTestEnv((p) => {
    processes = p
    identifiers = Object.keys(processes)
    TESTER = test.getTester()
    setTimeout(done, 10000)
  }, 'xyz.test.join.json')
})

it('initial state', function (done) {
  _send('inspectJSON', processes[identifiers[0]], (data) => {
    expect(data.global.systemConf.nodes.length).to.equal(TOTAL)
    expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL)
    _send('inspectJSON', processes[identifiers[1]], (data) => {
      expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL)
      expect(data.global.systemConf.nodes.length).to.equal(TOTAL)
      _send('inspectJSON', processes[identifiers[2]], (data) => {
        expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL)
        expect(data.global.systemConf.nodes.length).to.equal(TOTAL)
        _send('inspectJSON', processes[identifiers[3]], (data) => {
          expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL)
          expect(data.global.systemConf.nodes.length).to.equal(TOTAL)
          done()
        })
      })
    })
  })
})

it('add a new one on the fly', function (done) {
  this.timeout(3000)
  TESTER.call({
    servicePath: '/node/create',
    payload: {
      path: 'test/tests/ms/string.ms.js',
      params: `--xyz-transport.0.port 5050 --xyz-seed 127.0.0.1:4000 --xyz-cli.enable true --xyz-cli.stdio file`
    }
  }, (err, body, resp) => {
    expect(body).to.equal('Done')
    setTimeout(() => {
      _send('inspectJSON', processes[identifiers[0]], (data) => {
        expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 1)
        expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
        _send('inspectJSON', processes[identifiers[1]], (data) => {
          expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
          expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 1)
          _send('inspectJSON', processes[identifiers[2]], (data) => {
            expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
            expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 1)
            _send('inspectJSON', processes[identifiers[3]], (data) => {
              expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
              expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 1)
              TESTER.call({
                servicePath: 'node/inspectJSON', payload: 'string.ms@127.0.0.1:5050'
              }, (err, body, resp) => {
                expect(Object.keys(body.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
                expect(body.global.systemConf.nodes.length).to.equal(TOTAL + 1)
                done()
              })
            })
          })
        })
      })
    }, 2000)
  })
})

const PORT = 7000
it('add a new one with different seed node', function (done) {
  const SEED = '127.0.0.1:5010'
  this.timeout(3000)
  TESTER.call({
    servicePath: '/node/create',
    payload: {
      path: 'test/tests/ms/string.ms.js',
      params: `--xyz-transport.0.port ${PORT} --xyz-seed ${SEED} --xyz-cli.enable true --xyz-cli.stdio file`
    }
  }, (err, body, resp) => {
    expect(body).to.equal('Done')
    setTimeout(() => {
      _send('inspectJSON', processes[identifiers[0]], (data) => {
        expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 2)
        expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 2)
        _send('inspectJSON', processes[identifiers[1]], (data) => {
          expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 2)
          expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 2)
          _send('inspectJSON', processes[identifiers[2]], (data) => {
            expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 2)
            expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 2)
            _send('inspectJSON', processes[identifiers[3]], (data) => {
              expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 2)
              expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 2)
              TESTER.call({
                servicePath: 'node/inspectJSON', payload: `string.ms@127.0.0.1:${PORT}`
              }, (err, body, resp) => {
                expect(Object.keys(body.ServiceRepository.foreignServices).length).to.equal(TOTAL + 2)
                expect(body.global.systemConf.nodes.length).to.equal(TOTAL + 2)
                done()
              })
            })
          })
        })
      })
    }, 2000)
  })
})

it('remove one of them', function (done) {
  this.timeout(20000)
  TESTER.call({
    servicePath: 'node/kill',
    payload: `string.ms@127.0.0.1:${PORT}`
  }, (err, body, resp) => {
    expect(body).to.equal('Done')
    setTimeout(() => {
      _send('inspectJSON', processes[identifiers[0]], (data) => {
        expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 1)
        expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
        _send('inspectJSON', processes[identifiers[1]], (data) => {
          expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
          expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 1)
          _send('inspectJSON', processes[identifiers[2]], (data) => {
            expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
            expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 1)
            _send('inspectJSON', processes[identifiers[3]], (data) => {
              expect(Object.keys(data.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
              expect(data.global.systemConf.nodes.length).to.equal(TOTAL + 1)
              TESTER.call({
                servicePath: 'node/inspectJSON', payload: 'string.ms@127.0.0.1:5050'
              }, (err, body, resp) => {
                expect(Object.keys(body.ServiceRepository.foreignServices).length).to.equal(TOTAL + 1)
                expect(body.global.systemConf.nodes.length).to.equal(TOTAL + 1)
                done()
              })
            })
          })
        })
      })
    }, 15000)
  })
})

after(function () {
  for (let p in processes) {
    processes[p].kill()
  }
})
