function _authIntroduce (params, next, end, xyz) {
  let payload = params[2]
  if (payload.title === 'introduce') {
    if (xyz.CONFIG.getSystemConf().nodes.indexOf(payload.id) === -1) {
      let response = params[1]
      response.writeHead(401)
      response.jsonify({error: 'you are not a known node to me. Tyy sending a join req first'})
      return
    }
    next()
  } else {
    next()
  }
}
module.exports = _authIntroduce
