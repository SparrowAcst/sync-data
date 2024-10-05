const yargs = require("yargs");
const s3bucket = require("./src/utils/s3-bucket")

const settings = yargs.argv;
 
const list = async settings => {
	let { p } = settings
	return (await s3bucket.list(p))
}

const metadata = async settings => {
	let { p } = settings
	return (await s3bucket.metadata(p))
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

}

run()
