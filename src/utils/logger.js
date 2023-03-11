const pino = require('pino')
const { tmpdir } = require('os')
const { join } = require('path')



module.exports = (file, parent) => {
 
  // file = file || join(tmpdir(), `${process.pid}-log`)

  // console.log(`Log file: ${file}`)  

  let targets = []

  if(file) {
    targets.push(
      // {
      //   target: 'pino/file',
      //   options: { 
      //     destination: file,
      //     mkdir: true,
      //     append: false 
      //   }
      // }  
      {
        target: 'pino-pretty',
        options: {
          destination: file,
          mkdir: true,
          colorize: false,
          append: false
        }
      }
    )
  }

  targets.push({
    target: 'pino-pretty'
  })
  
  const transport = pino.transport({ targets })
  
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
