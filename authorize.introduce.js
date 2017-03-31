function _authIntroduce (xMessage, next, end, xyz) {
  let message = xMessage.message
  if (message.userPayload.title === 'introduce') {
    if (xyz.CONFIG.getSystemConf().nodes.indexOf(message.xyzPayload.senderId) === -1) {
      let response = xMessage.response
      response.writeHead(401)
      response.jsonify({error: 'you are not a known node to me. Try sending a join req first'})
      return
    }
    next()
  } else {
    next()
  }
}
module.exports = _authIntroduce
