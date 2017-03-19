# xyz.ping.swim.bootstrap

SWIM ping bootstrap function for xyz-core.

[![Build Status](https://travis-ci.org/node-xyz/xyz.ping.swim.bootstrap.svg?branch=master)](https://travis-ci.org/node-xyz/xyz.ping.swim.bootstrap) [![npm version](https://badge.fury.io/js/xyz.ping.swim.bootstrap.svg)](https://badge.fury.io/js/xyz.ping.swim.bootstrap)

---

This module implements the [SWIM](http://www.cs.cornell.edu/~asdas/research/dsn02-SWIM.pdf) (**S**calable **W**eakly-consistent **I**nfection-style Process Group **M**embership
Protocol) protocol with slight changes. You can referee to the main paper for more detail.

This protocol is more efficient than other ping modules of xyz and is suitable for deploy environment.

# Description

our current ping system (the Default Ping) is known as a `heartbeat` approach. It's robust but quite overloaded. The basic SWIM has the following properties:
  - an arbitrary node will choose a random ping target (`M_i`) at each ping period.
    - if the `M-i` answers successfully, the period ends.
    - if not, the node will choose `K` random ambassadors for `indirect` probing. It will send `ping-req(M_i)` to these K ambassadors. If all of them return a negative response, indicating that `M_i` is down, `M_i` will be kicked.
  - if `M_i` is detected as down, this message will be multicasted to all other nodes.
    - It is an important note that since the `failure detection` phase is pretty strict, (1 + K nodes must fail to probe a node to mark it as down), this phase is based in **trust**, meaning that everyone in the system will trust this multicast message and will apply it without any further investigation.

Comparing it with the Default Ping, one big drawback is that our current ping messages carry a huge weight (`serializedPathTree + nodes + servers`). To address this issue, the SWIM ping uses two kinds of messages:

- an HTTP message will be used for `introduction` phase, during which all of the important information of a node will be carries to other nodes. This information contains `serializedPathTree + nodes + servers`.
- After the **introduction** the phase, the Probing phase kicks in which uses light-weight UDP messages inly carrying minimal information, such as the identifier (`xyz.id().netId`) of the sender.

# Usage

The module can be installed using

```bash
$ npm install --save xyz.ping.swim.bootstrap
```

Like other pings, if it is to be used, you should disable the Default Ping:

```
var ms = new XYZ({
  selfConf: {
    defaultBootstrap: false
  },
  systemConf: {nodes: []}
})
```

You can later bootstrap your node using:

```javascript
const SWIM = require('xyz.ping.swim.bootstrap')
stringMs.bootstrap(SWIM, config)
```

where config is an object with the following possible keys:

|    option   | default value   | description |
|:-----------:|-----------------|-------------|
| `config.httpPort`        | `xyz.id().port`       |  port of the server used for http messages   |
| `config.udpPort`         | `xyz.id().port + 1`   |   port of the server used for udp messages      |
| `config.httpPrefix`      | 'SPING_HTTP'          |      Name of the route created in HTTP server      |
| `config.udpPrefix`       | 'SPING_HTTP'          |      Name of the route created in HTTP server      |
| `config.interval`         | 2000                 |     interval for random probing in ms     |
| `config.probeTimeout`     | 5000                 |     timeout for waiting for a probe to be responded in ms      |
| `config.maxOutOfReachWait`| 5                    |     failure tolerance in introduction phase     |

> Note that all nodes using the same ping mechanism **must** use the same `httpPrefix` and `udpPrefix`.

> SWIM ping supports join and seed nodes similar to how they function in Default Ping.


To see this in action, if you run a node using this and `console.log` your node you see:

```bash
____________________  TRANSPORT LAYER ____________________
Transport:
  outgoing middlewares:
    call.dispatch.mw [/CALL] || _httpExport[0]
    swim.http.dispatch.mw [/SPING_HTTP] || _httpExport[0]
    swim.udp.dispatch.mw [/SPING_UDP] || _udpExport[0]

  HTTPServer @ 4000 ::
    Middlewares:
    call.receive.mw [/CALL] || _httpMessageEvent[0]
    swim.http.receive.mw [/SPING_HTTP] || _authIntroduce[0] -> onHttpPingReceive[1]

  UDPServer @ 4001 ::
    Middlewares:
    swim.udp.receive.mw [/SPING_UDP] || onUdpPingReceive[0]

```

- `swim.http.receive.mw [/SPING_HTTP]` has been added to the default server (port 4000)
- a new UDP server has been created in `xyz.id().port + 1` with `swim.udp.receive.mw [/SPING_UDP] || onUdpPingReceive[0]`.
- Two new outgoing routes have been created, one for HTTP messages and one for UDP messages.
