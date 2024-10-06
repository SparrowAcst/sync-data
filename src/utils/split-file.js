const fs = require('fs')
const fsp = fs.promises 
const fse = require('fs-extra')
const path = require('path')
const pad = require("zeropad")

const generateFilePath = (file, n, dest) => path.resolve(dest || "./", `${path.basename(file)}-chunk-${pad(n, 5)}`)

const splitFile = ( file, chunkSize, dest ) => new Promise ( async (resolve, reject) => {
  let stats = await fsp.stat(file)
  dest = dest || "."

  if(!fse.pathExistsSync(dest)){
    await fse.mkdirs(path.resolve(dest))
  }  

  let fileSize = stats.size
  let chunksCount = Math.floor(fileSize / chunkSize)
  chunksCount = chunksCount || 1
  let chunks = []
  for( let i=0; i<chunksCount; i++){
    let chunk = {
      file: generateFilePath(file, i, dest),
      start: i*chunkSize,
      end: (i < chunksCount-1) ? i*chunkSize + chunkSize-1 : fileSize 
    }
    chunk.size = chunk.end - chunk.start
    chunks.push(chunk)
  }

  await Promise.all( chunks.map( chunk => new Promise( (resolve, reject) => {
    let readStream = fs.createReadStream(file, {
        encoding: null,
        start: chunk.start,
        end: chunk.end
    })
    let writeStream = fs.createWriteStream(chunk.file)
    writeStream.on("error", e => {
      reject(e)
    })
    readStream.on('end', resolve)
    readStream.pipe(writeStream)
  })))

  resolve(chunks.map(chunk => chunk.file))
}) 


const mergeFile = async ( chunks, dest ) => {
  
  dest = path.resolve(dest)
  
  if( !fse.pathExistsSync(path.dirname(dest)) ){
    await fse.mkdirs(path.resolve( path.dirname(dest)))
  }

  let writeStream = fs.createWriteStream(dest)

  for( const chunk of chunks ) {
    await new Promise((resolve, reject) => {
        fs
          .createReadStream(chunk)
          .on('data', a => writeStream.write(a))
          .on('end', resolve)
          .on('error', reject)
    })
  }

  writeStream.close()

}


module.exports = {
  splitFile,
  mergeFile
}


// const run = async () => {
//   let chunks = await splitFile("./.tmp/source.zip", 2*1024*1024, "./.tmp/")
//   await mergeFile(chunks, "./.tmp/merged.zip")
// }

// run()  