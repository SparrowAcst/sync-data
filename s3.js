const yargs = require("yargs");
const s3bucket = require("./src/utils/s3-bucket")
const { sortBy } = require("lodash")
const settings = yargs.argv;

const dir = async settings => {
  let { p, d } = settings
  if(d){
    s3bucket.setBucket(d)
  }
  return (await s3bucket.dir(p))
}

const tree = async settings => {
  let { p, d } = settings
  if(d){
    s3bucket.setBucket(d)
  }
  let res = await s3bucket.tree(p)
  res = sortBy( res.map( d => d.Prefix))
  return res
}

const copy = async settings => {
  let { s, t, d } = settings
  if(d){
    s3bucket.setBucket(d)
  }
  await s3bucket.copy({
    source: s, 
    target: t,
    callback: ({sourceBucketAlias, sourceKey, destinationBucketAlias, destinationKey}) => {
      console.log(`${sourceBucketAlias}:${sourceKey} > ${destinationBucketAlias}:${destinationKey}`)
    }
  })
}

const deleteFiles = async settings => {
  let { p, d } = settings
  if(d){
    s3bucket.setBucket(d)
  }
  return (await s3bucket.deleteFiles(p))
}

 
const list = async settings => {
	let { p, d } = settings
  if(d){
    s3bucket.setBucket(d)
  }
	return (await s3bucket.list(p))
}

const metadata = async settings => {
	let { p, d } = settings
  if(d){
    s3bucket.setBucket(d)
  }
	return (await s3bucket.metadata(p))
}

const download = async settings => {
  let { s, t, d } = settings
  if(d){
    s3bucket.setBucket(d)
  }
  return (await s3bucket.download({
    source: p,
    target: t
  }))
}

const url = async settings => {
  let { p, d } = settings
  if(d){
    s3bucket.setBucket(d)
  }
  return (await s3bucket.getPresignedUrl(p))
}




const run = async () => {
  
  if(settings.list){
  	console.log("List S3 bucket: ", settings.d || "default", settings.p)
  	console.log((await list(settings)))
  	return
  }

  if(settings.metadata){
  	console.log("S3 bucket metadata: ", settings.d || "default", settings.p)
  	console.log((await metadata(settings)))
  	return
  }

  if(settings.info){
    console.log("S3 bucket info: ", settings.d || "default", settings.p)
    console.log((await metadata(settings)))
    return
  }

  if(settings.dir){
    console.log("S3 bucket dir: ", settings.d || "default", settings.p)
    console.log((await dir(settings)))
    return
  }

  if(settings.tree){
    console.log("S3 bucket tree: ", settings.d || "default", settings.p)
    console.log((await tree(settings)))
    return
  }

  // if(settings.delete){
  //   console.log("S3 bucket delete: ", settings.p)
  //   if(!settings.p) {
  //     console.log("Path required")
  //     return
  //   }
  //   console.log((await deleteFiles(settings)))
  //   return
  // }

  if(settings.download){
    console.log("S3 bucket download: ", settings.d || "default", settings.s, settings.t)
    console.log((await download(settings)))
    return
  }

  if(settings.url){
    console.log("S3 bucket url: ", settings.d || "default", settings.p)
    console.log((await url(settings)))
    return
  }

  if(settings.copy){
    console.log("S3 bucket copy: ", settings.d || "default", settings.s, settings.t)
    await copy(settings)
    return
  }


}

run()
