const interval = 2 * 1000
const threshold = 5 * 1000
const probeTimeout = 5 * 1000
const maxOutOfReachWait = 5
const GenericMiddlewareHandler = require('xyz-core/src/Middleware/generic.middleware.handler')
const _httpExport = require('xyz-core/src/Transport/Middlewares/call/http.export.middleware')
const _udpExport = require('xyz-core/src/Transport/Middlewares/call/udp.export.middleware')
const chalk = require('chalk')

let stochasticPingBoostraper = (xyz, config) => {
  config = config || {}
  config.httpPort = config.httpPort || Number(xyz.id().port)
  config.udpPort = config.udpPort || Number(xyz.id().port) + 1
  // variables passed through xyz instance
  let logger = xyz.logger
  let CONFIG = xyz.CONFIG
  const CONSTANTS = xyz.CONSTANTS
  const Util = xyz.Util
  let wrapper = xyz.Util.wrapper

  let SR = xyz.serviceRepository
  let transport = SR.transport
  const _id = xyz.id().netId

  /**
   * will send introductory info to each node. should be called once for each foreign node
   *
   * information like services should be exchanged in this phase. This phase is done using HTTP
   *
   * @method introduction
   * @param  {[type]}     destNode destination node. node format is a string with format `IP:PRIMARY_PORT`
   * @return {null} null
   */
  let introductionOutOfReach = []
  function introduce (destNode) {
    if (isNaN(introductionOutOfReach[destNode])) { introductionOutOfReach[destNode] = 0 }

    transport.send({
      node: destNode,
      route: httpPrefix,
      payload: {title: 'introduce', id: _id}
    }, (err, body, resp) => {
      if (err) {
        logger.error(`SWIM :: introduction to ${destNode} failed [out of reach for ${introductionOutOfReach[destNode]}]: ${err} - ${JSON.stringify(body)}`)
        if (introductionOutOfReach[destNode] >= maxOutOfReachWait) {
          SR.kickNode(destNode)
          return
        } else {
          setTimeout(() => {
            introductionOutOfReach[destNode] ++
            introduce(destNode)
          }, interval)
        }
      } else {
        // TODO: we are not using `nodes` key of the response...
        logger.verbose(`SWIM :: introduction handshake with ${destNode} done.`)
        SR.foreignNodes[destNode] = body.services
        SR.foreignRoutes[destNode] = body.transportServers
      }
    })
  }

  function broadcastHttp (payload, cb) {
    let nodes = CONFIG.getSystemConf().nodes
    let total = nodes.length
    let sent = 0
    for (let node of nodes) {
      transport.send({
        route: httpPrefix,
        payload: payload,
        node: node
      }, function (_node, err, body, resp) {
        if (err) {
          logger.error(`SWIM :: braodcasting ${JSON.stringify(payload)} to ${node} failed`)
        } else {
          sent++
          if (sent === total) {
            cb(null, `SWIM :: message broadcastet to ${nodes} successfully`)
          }
        }
      }.bind(null, node))
    }
  }

  let joinIndex = 0
  let seeds = CONFIG.getSelfConf().seed
  function join () {
    let destNode = seeds[joinIndex]
    logger.verbose(`SWIM :: attempting join via ${destNode}`)
    transport.send({
      node: destNode,
      route: httpPrefix,
      payload: {title: 'join-req', id: _id}
    }, (err, body) => {
      if (err) {
        logger.error(`SWIM :: join via ${destNode} failed. trying next seed node...`)
        joinIndex = (joinIndex + 1) % (seeds.length)
        setTimeout(join, interval + Util.Random(threshold))
      } else {
        logger.info(`SWIM :: join sucess. new nodes: ${JSON.stringify(body.nodes)}`)
        for (let node of body.nodes) {
          SR.joinNode(node)
          introduce(node)
        }
      }
    })
  }

  /**
   * Handle an introduction from another node
   * @method onIntroduction
   * @return {[type]}       [description]
   */
  function onIntroduce (target, response) {
    response.jsonify({
      services: SR.services.serializedTree,
      nodes: CONFIG.getSystemConf().nodes,
      transportServers: SR.transport.getServerRoutes()})
  }

  /**
   * Directly probe a node. Will send a UDP message and wait a certain amount
   * of time for a response.
   * @method directProbe
   * @param  {String}     destNode destination node. node format is a string with format `IP:PRIMARY_PORT`
   * @return {null} null
   */
  let directProbeTargets = {}
  function directProbe (destNode, indirect = false, response = null) {
    let nounce = Math.random() * (1000000)
    // NOTE: here we have two options, either to use the config.udpPort
    // to fix `destNode`
    // or to set redirec: true
    transport.send({
      node: destNode,
      route: UdpPrefix,
      redirect: true,
      payload: {title: 'directProbe', nounce: nounce, id: _id}
    }, (err, body, _response) => {
      let timeout = setTimeout(() => {
        indirectProbeReq(destNode)
      }, probeTimeout)

      directProbeTargets[destNode] = {
        timeout: timeout,
        nounce: nounce,
        indirect: indirect,
        response: response
      }
    })
  }

  /**
   * Handle a direct probe message from another node
   * @method onDirectProbe
   * @return {null} null
   */
  function onDirectProbe (payload) {
    transport.send({
      node: payload.id,
      redirect: true,
      route: UdpPrefix,
      payload: {title: 'directProbeResponse', nounce: payload.nounce, id: _id}
    }, (err, body, resp) => {
      logger.debug(`SWIM :: directProbe from ${chalk.bold(payload.id)} responded.`)
    })
  }

  /**
   * Handle the response of a direct probe from another node
   * @method onDirectProbeResponse
   * @param  {[type]}              payload [description]
   * @return {[type]}                      [description]
   */
  function onDirectProbeResponse (payload) {
    if (directProbeTargets[payload.id]) {
      if (payload.nounce === directProbeTargets[payload.id].nounce) {
        // it was an indirect probe, so responde to the sender
        if (directProbeTargets[payload.id].indirect) {
          directProbeTargets[payload.id].response.jsonify({status: true})
        } else {
          clearTimeout(directProbeTargets[payload.id].timeout)
          delete directProbeTargets[payload.id]
          logger.debug(`SWIM :: node ${chalk.bold.underline(payload.id)} responded to direct probe with nounce ${payload.nounce}`)
        }
      } else {
        logger.warn(`SWIM ::node ${chalk.bold(payload.id)} responded to direct probe with incorrect nounce. requesting indirect probe`)
        if (directProbeTargets[payload.id].indirect) {
          directProbeTargets[payload.id].response.jsonify({status: false})
        } else {
          // TODO: now I should either kick this or request an indirect probe
          SR.kickNode(payload.id)
        }
      }
    } else {
      logger.warn(`SWIM :: node ${chalk.bold(payload.id)} responded to direct probe while I did not ask him to do so`)
    }
  }
  /**
   * Handel indirect probe request message from another node
   * @method onIndirectProbe
   * @return {null} null
   */
  function onIndirectProbeReq (payload, response) {
    logger.warn(`${payload.id} has aked me to probe ${payload.target}`)
    directProbe(payload.target, true, response)
  }

  /**
   * Will randomly choose two ambassedors and ping a node using them.
   * This function is called only when a node fails to responde to a udp ping
   * should be called only after `directProbe()` fails
   * @method indirectProbe
   * @param  {[type]}     destNode destination node. node format is a string with format `IP:PRIMARY_PORT`
   * @return {null} null
   */
   // TODO: choose two random nodes and send an indirect probe to them
  function indirectProbeReq (destNode) {
    if (!directProbeTargets[destNode]) {
      logger.warn(`SWIM :: attempting to probe ${destNode} indirectly (or responde to previous probe-req) which does not exist anymore. skipping...`)
      return
    }
    if (directProbeTargets[destNode].indirect) {
      logger.warn(`SWIM :: I was asked to probe ${destNode} as ambassedor but it failed. Responding to sender...`)
      let response = directProbeTargets[destNode].response
      response.writeHead(404)
      response.jsonify({error: `node ${destNode} was unreachable.`})
      delete directProbeTargets[destNode]
      return
    }
    let nodes = CONFIG.getSystemConf().nodes
    let randomNode1 = nodes[Math.floor(Math.random() * nodes.length)]
    logger.verbose(`${chalk.bold(destNode)} failed. pinging it indirectly using ${chalk.bold(randomNode1)}`)
    transport.send({
      node: randomNode1,
      route: httpPrefix,
      payload: {
        title: 'indirectProbeReq',
        target: destNode,
        id: _id
      }
    }, (err, body, resp) => {
      if (err) {
        logger.warn(`SWIM :: indirect probe failed. braodcasting {${destNode}} LEAVE message`)
        SR.kickNode(destNode)
        broadcastHttp({
          title: 'leave',
          id: _id,
          target: destNode}, (err, resp) => {
          if (err) {
            logger.error(`error while broadcasting node ${destNode} leave ${err}`)
          } else {
            logger.verbose(`node ${destNode} kicked and broadcasted`)
          }
        })
      } else {
        logger.verbose(`node ${destNode} passed indirect Probe. ok`)
      }
    })
  }

  /**
   * Handle http ping events
   * @method onHttpPingReceive
   */
  function onHttpPingReceive (params, next, end) {
    let payload = params[2]
    let response = params[1]
    logger.verbose(`SWIM :: HTTP message received ${JSON.stringify(payload)}`)
    if (payload.title === 'introduce') {
      onIntroduce(payload.id, response)
    } else if (payload.title === 'indirectProbeReq') {
      onIndirectProbeReq(payload, response)
    } else if (payload.title === 'join-req') {
      // TODO: currently we have no auth for this phase
      // Note that maybe, the new node tries to introduce these response nodes,
      // before they are afarew of the join.
      // the key point is that `introduce` will have an auto retry
      response.jsonify({
        nodes: CONFIG.getSystemConf().nodes
      })
      broadcastHttp({
        title: 'join',
        target: payload.id
      }, (err, resp) => {
        if (err) logger.error(`error ${err} while broadcasting node join`)
        else logger.verbose(`node ${payload.id} join accepted. message is broadcasted.`)
      })
    } else if (payload.title === 'join') {
      SR.joinNode(payload.target)
      introduce(payload.target)
    } else if (payload.title === 'leave') {
      SR.kickNode(payload.target),
      response.jsonify({status: true, message: 'kicked'})
    }
  }

  /**
   * Handle udp ping events
   * @method onUdpPingReceive
   * @return {[type]}         [description]
   */
  function onUdpPingReceive (params, next, end, xyz) {
    let payload = params[0].json
    if (payload.title === 'directProbe') {
      onDirectProbe(payload)
    } else if (payload.title === 'directProbeResponse') {
      onDirectProbeResponse(payload)
    } else if (payload.title === 'indirectProbeResponse') {}
  }

  function validTargetForDirectProbe (target) {
    if (Object.keys(directProbeTargets).indexOf(target) > -1) {
      return false
    }
    return true
  }

  // ---- create all of the required middlewares
  // will create one new route on the server identified by the `port` parameter
  // TODO: configurable?
  const httpPrefix = 'SPING_HTTP'
  let pingHttpReceiveMW = new GenericMiddlewareHandler(xyz, 'pingHttpReceiveMW', httpPrefix)
  let pingHttpDispatchMW = new GenericMiddlewareHandler(xyz, 'pingHttpDispatchMW', httpPrefix)
  pingHttpReceiveMW.register(0, onHttpPingReceive)
  pingHttpReceiveMW.register(0, require('./authorize.introduce'))
  pingHttpDispatchMW.register(0, _httpExport)

  SR.transport.registerRoute(httpPrefix, pingHttpDispatchMW)
  SR.transport.servers[config.httpPort].registerRoute(httpPrefix, pingHttpReceiveMW)

  // will create one new dedicated UDP server for probing
  // TODO: why port + 1 ?
  const UdpPrefix = 'SPING_UDP'
  xyz.registerServer('UDP', config.udpPort, false)
  let pingUdpReceiveMW = new GenericMiddlewareHandler(xyz, 'pingUdpReceiveMW', UdpPrefix)
  let pingUdpDispatchMW = new GenericMiddlewareHandler(xyz, 'pingUdpDispatchMW', UdpPrefix)
  pingUdpReceiveMW.register(0, onUdpPingReceive)
  pingUdpDispatchMW.register(0, _udpExport)

  xyz.registerServerRoute(config.udpPort, UdpPrefix, pingUdpReceiveMW)
  xyz.registerClientRoute(UdpPrefix, pingUdpDispatchMW)

  logger.info(`swim ping bootstraped for approx. every ${chalk.bold(interval)} ms`)

  // introduce yourslef to all available nodes
  for (let node of CONFIG.getSystemConf().nodes) {
    introduce(node)
  }

  if (seeds.length) {
    join()
  }
  // probe a random node
  {
    setInterval(() => {
      let nodes = CONFIG.getSystemConf().nodes
      let randomNode = nodes[Math.floor(Math.random() * nodes.length)]
      if (validTargetForDirectProbe(randomNode)) {
        logger.debug(`SWIM :: direct probe for next interval chosen randomly: ${randomNode}`)
        directProbe(randomNode)
      } else {
        logger.debug(`invalid target ${randomNode} chosen for random probe. passing.`)
      }
    }, interval)
  }

  if (config.event) {
    // what should i do here...?
  }
}

module.exports = stochasticPingBoostraper
