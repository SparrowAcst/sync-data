const pino = require('pino')
const { tmpdir } = require('os')
const { join } = require('path')



module.exports = file => {
 
  file = file || join(tmpdir(), `${process.pid}-log`)

  console.log(`Log file: ${file}`)  
  
  const transport = pino.transport({
    targets: [{
      target: 'pino/file',
      options: {
        destination: file,
        mkdir: true
      }
    }, {
      target: 'pino-pretty'
    }]
  })

  return pino(transport)

}
