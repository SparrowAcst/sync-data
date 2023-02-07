const pino = require('pino')
const { tmpdir } = require('os')
const { join } = require('path')



module.exports = (file, parent) => {
 
  file = file || join(tmpdir(), `${process.pid}-log`)

  console.log(`Log file: ${file}`)  
  
  const transport = pino.transport({

    targets: [
      {
        target: 'pino-pretty',
        options: {
          destination: file,
          mkdir: true,
          colorize: false
        }
      },
      {
        target: 'pino-pretty'
      }
    ]
  })
  
  let logger = pino(transport)
  if(parent){

    return {
      info: message => {
        logger.info(message)
        process.send({time: new Date(), data: message})
      }
    }
  
  } else {
   
    return logger  
  
  } 
  

}
