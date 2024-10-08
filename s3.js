const yargs = require("yargs");
const s3bucket = require("./src/utils/s3-bucket")

const settings = yargs.argv;

const dir = async settings => {
  let { p } = settings
  return (await s3bucket.dir(p))
}

const deleteFiles = async settings => {
  let { p } = settings
  return (await s3bucket.deleteFiles(p))
}

 
const list = async settings => {
	let { p } = settings
	return (await s3bucket.list(p))
}

const metadata = async settings => {
	let { p } = settings
	return (await s3bucket.metadata(p))
}

const download = async settings => {
  let { s, t } = settings
  return (await s3bucket.download({
    source: p,
    target: t
  }))
}

const url = async settings => {
  let { p } = settings
  return (await s3bucket.getPresignedUrl(p))
}




const run = async () => {
  
  if(settings.list){
  	console.log("List S3 bucket: ", settings.p)
  	console.log((await list(settings)))
  	return
  }

  if(settings.metadata){
  	console.log("S3 bucket metadata: ", settings.p)
  	console.log((await metadata(settings)))
  	return
  }

  if(settings.info){
    console.log("S3 bucket info: ", settings.p)
    console.log((await metadata(settings)))
    return
  }

  if(settings.dir){
    console.log("S3 bucket dir: ", settings.p)
    console.log((await dir(settings)))
    return
  }

  if(settings.delete){
    console.log("S3 bucket delete: ", settings.p)
    if(!settings.p) {
      console.log("Path required")
      return
    }
    console.log((await deleteFiles(settings)))
    return
  }

  if(settings.download){
    console.log("S3 bucket download: ", settings.s, settings.t)
    console.log((await download(settings)))
    return
  }

  if(settings.url){
    console.log("S3 bucket url: ", settings.p)
    console.log((await url(settings)))
    return
  }


}

run()
