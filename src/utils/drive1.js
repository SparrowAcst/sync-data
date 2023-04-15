


const { google } = require("googleapis")
const path = require("path")
const { getMIMEType } = require('node-mime-types')
const fs = require("fs")
const { find, findIndex, isUndefined, extend, last, uniqBy, maxBy } = require("lodash")
const nanomatch = require('nanomatch')
const YAML = require("js-yaml")
const {getFolder} = require("./drive-helper")

const key = require(path.join(__dirname,"../../.config/key/gd/gd.key.json"))

// const jwtClient = new google.auth.JWT(
//   key.client_email,
//   null,
//   key.private_key,
//   ["https://www.googleapis.com/auth/drive"],
//   "andrii.boldak@sparrowacoustics.com"
// );

// const drive = google.drive({version: 'v3', auth: jwtClient});

let logger


const delay = (ms, msg) => new Promise(resolve => {
	
	let total = ms
	let delta = 1000
	
	process.stdout.write(`Wait Google Drive ${Math.round(ms/delta)}s for ${msg} ${'\x1b[0G'}`)
	
	let interval = setInterval(() => {
		ms -= delta
		process.stdout.write(`Wait Google Drive ${Math.round(ms/delta)}s for ${msg} ${'\x1b[0G'}`)
		if(ms <= 0){
			process.stdout.write(`${'\x1b[0G'}`)
			clearInterval(interval)
			resolve()	
		}
	}, delta)

})



const getPath = (files, node) => {
	let res = []
	for( let n = node; ; ){
		res.push(n.name)
		if(isUndefined(n.parents)) break
		n = find(files, f => n.parents.includes(f.id))
		if(!n) break	
	}	
	res.reverse()
	return res.join("/")	
}

const getList = files => {
	const raws = files.map( f => extend(f, { path: getPath(files,f) }))
	const pathes = uniqBy(raws, "path").map( d => d.path)
	let res = []
	pathes.forEach( p => {
		res.push( maxBy(raws.filter(r => r.path == p), "modifiedTime"))
	})
	return res

}	


async function loadList({ drive, options}){
	try {
	  	let res = []
	  	let nextPageToken
	  	do {
	
	  		const part = await drive.files.list(
	  			extend( 
	  				{}, 
	  				{
			  		  pageSize: 250,
				      pageToken: nextPageToken || "",	
				      fields: "files(id, webViewLink, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size, trashed, version, owners ), nextPageToken",
				      spaces: 'drive'
				    },
				    options
				)
			)		
		    res = res.concat(part.data.files)
		    nextPageToken = part.data.nextPageToken
	
	  	} while (nextPageToken)

	  	return res
  	
  	} catch (e) {
  		logger.info(e.toString())
    	throw e;
  	}
}

// async function getFolder ({ path = "", drive, createIfMissing = false}) {
	
// 	let pathes = path.split("/").filter( p => p)
// 	let prevs = []
// 	let temp = []

// 	for( let i=0; i < pathes.length; i++ ) {
		
// 		let name = pathes[i]
// 		// console.log(name)

// 		let q = `name='${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
// 		let currents = []
// 		// console.log("prevs", prevs)
// 		if(prevs.length > 0) {
		
// 			for( let j=0; j < prevs.length; j++) {
// 				// console.log(prevs[j])
// 				const q1  = q + ` and '${prevs[j].id}' in parents`
// 				// console.log(`"${q1}"`)
// 				let part = await loadList({drive, options:{q: q1}})
// 				temp.push(prevs[j])
// 				currents = currents.concat(part)
// 			}
		
// 		} else {
// 			currents = await loadList({drive, options:{q}})
// 			if(i == 0) {
// 				currents = currents.filter( f => !f.parents)
// 			}
// 		}
		
// 		prevs = currents.map( d => d )
// 		// console.log(prevs.length)	
	
// 	}

// 	let cache = []
// 	prevs.forEach( p => {
// 		for( let c = p; !isUndefined(c); c = find(temp, f => c.parents && c.parents.includes(f.id))){
// 			cache.push(c)
// 		}
// 	})

// 	cache = uniqBy(cache, c => c.id)

// 	// cache = cache.concat(prevs)
// 	// cache = cache.filter( f => prevs.map(p => p.parents).includes(f.id))
// 	console.log(cache)



// 	console.log("RETURN\n", JSON.stringify(prevs, null, " "))
	
// 	return {
// 		cache,
// 		endPoints: prevs
// 	}

// }


async function getTree ({ id, drive}) {
	
	let temp = []
	let prevs = []
	let currents = await loadList({drive, options:{q: `'${id}' in parents and trashed = false` }})
	
	for( let prevs =  currents.map(d => d); prevs.length > 0;  ) {
		
		temp = temp.concat(prevs)

		let nextWave = []
		for(let j=0; j< prevs.length; j++){
			let part = await loadList({drive, options:{q: `'${prevs[j].id}' in parents and trashed = false` }})
			nextWave = nextWave.concat(part)	
		}

		prevs = nextWave.map(d => d)
		
	}	
	
	// console.log("RETURN TREE\n", JSON.stringify(temp, null, " "))
	
	return temp

}


// async function getDirList(drive, rootPath) {
//   try {

//   	let pathes = rootPath.split("/").filter( d => d)
//   	const varPartIndex = findIndex(pathes, p => /\*/g.test(p))
//   	const folderPath = (varPartIndex > -1) 
//   						? pathes.slice(0, findIndex(pathes, p => /\*/g.test(p)) ).join("/")
//   						: rootPath

//   	console.log(folderPath)
//   	const folders = await getFolder({drive, path: folderPath})

//   	let res = []

//   	for( let i=0; i < folders.endPoints.length; i++){
//   		const folder = folders.endPoints[i]
//   		const list = await getTree({ id:folder.id, drive })
//   		res = res.concat(list.cache)
//   	} 

//   	res = uniqBy(res.concat(folders.cache), f => f.id)

//   	let list = getList(res)
  	
//   	// list = list.filter(f => !f.trashed)

//   // 	if( rootPath ) {
//   // 		rootPath = (rootPath) ? `${rootPath}/**/*.*` : "**/*.*"
// 		// const names = nanomatch(list.map(f => f.path), rootPath)
// 		// list = list.filter(f => names.includes(f.path))
//   // 	}
//   	console.log(JSON.stringify(list, null, " "))

//     return list;

//   } catch (e) {
//     console.log(e.toString())
//     throw e;
//   }
// }


const buildPath = ( drive, point ) => new Promise( async resolve => {
	let current = point
	let result = [current]
	for(; current && current.parents; ){
		
		// console.log(current)
		// let p = (await stub.list( f => current.parents.includes(f.id)))[0]
		
		let p = (await drive.files.get({
  		  fileId: current.parents[0],
  		  fields: 'id, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size'
	    })).data
		
		current = p
		
		if(current){
			result.push(p)
		}
	}

	result.reverse()
	point.path = result.map( r => r.name).join("/")
	console.log(point.path)
	resolve( point )
})

const FOLDER = "application/vnd.google-apps.folder"
async function getDirList(drive, pattern) {
  try {
  	console.log(`Load: "${pattern}"`)
  	let res = []
  	let nextPageToken
  	do {
  		const part = await drive.files.list({
  		  q: `trashed = false and mimeType != '${FOLDER}'`, 
  		  pageSize: 25,
	      pageToken: nextPageToken || "",	
	      fields: "files(id, webViewLink, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size, trashed, version ), nextPageToken",
	      spaces: 'drive',
	    });	

  		let files = part.data.files
  		console.log(files.length)
 		
  // 		for( p of files){
  // 			console.log(p.name)
		//    	p.path = (await buildPath( drive, p ))
		// }

		files = await Promise.all(files.map(f => buildPath( drive, f )))

		let pathes = nanomatch(files.map(f => f.path), pattern)

		files = files.filter( f => pathes.includes(f.path))

	    res = res.concat(files)
	    console.log("RES", res.length)
	    // process.stdout.write(`${res.length} files                  ${'\x1b[0G'}`)
		
	    nextPageToken = part.data.nextPageToken
  	} while (nextPageToken)

    return res;

  } catch (err) {
    console.log(err.toString())
    throw err;
  }
}


const Drive = class {
	
	constructor (drive, filelist, subject) {
		this.$filelist = filelist || []
		this.$drive = drive
		this.$subject = subject
	}

	// async initiate(query){

	// 	const filelist = this.list(query)
	// 	console.log(this.$filelist.length, filelist.length)
	// 	return new Drive(filelist)

	// }

	getFolder(path){
		return getFolder({
			client: this.$drive,
			path
		})
	}

	async loadTree(path) {

		let f 
		
		try {
			
			f = await this.getFolder(path)
		
		} catch(e){
			logger.info(e.toString())
		}	
		
		if(!f) return []
			
		let files  = await getTree({
			drive: this.$drive,
			id: f.id
		})
		this.$filelist = getList(files)
		const prefix = path.split("/").slice(0,-1).join("/")

		this.$filelist.forEach( f => {
			f.path = `${prefix}/${f.path}`
		}) 

	}

	async loadList(pattern){
		this.$fileList = await getDirList(this.$drive, pattern)
	}

	dirList(path){
		path = path || "**/*"
		const names = nanomatch(this.$filelist.map(f => f.path), path)
		return this.$filelist.filter(f => names.includes(f.path) && f.mimeType == "application/vnd.google-apps.folder")
	}

	fileList(path){
		path = path || "**/*.*"
		const names = nanomatch(this.$filelist.map(f => f.path), path)
		return this.$filelist.filter(f => names.includes(f.path) && f.mimeType != "application/vnd.google-apps.folder")
	}

	list(path){
		path = path || "**/*.*"
		const names = nanomatch(this.$filelist.map(f => f.path), path)
		return this.$filelist.filter(f => names.includes(f.path))
	}

	itemList(){
		return this.$filelist
	}

	doublicateList(path){
		let filelist = this.fileList(path)
		let res = []
		for(let i = 0; i < filelist.length; i++){
			for( let j = i+1; j < filelist.length; j++){
				if( filelist[i].md5Checksum === filelist[j].md5Checksum) {
					if(filelist[i].name != filelist[j].name){
						res.push([filelist[i], filelist[j]])
					}
				}
			}
		}
		return res
	}

	dirTree(path){
		let nodes = this.itemList(path) 
		nodes.forEach( node => {
			node.childs = this.$fileList.filter( f => f.parents && f.parents.includes(node.id))
			if(node.childs.length > 0){
				node.childs = node.childs.map( n => getTree(n.path))
			} else {
				delete node.childs
			}	
		})
		return nodes
	}


	async downloadFile(file, destPath){

		return new Promise( async (resolve, reject) => {

			logger.info(`Download ${file.path} into ${destPath}/${file.name}}`)
			let inputStream = await this.geFiletWriteStream(file)
			let destStream = fs.createWriteStream(`${destPath}/${file.name}`)
			
			inputStream.on("data", chunk => {
				process.stdout.write(`DOWNLOAD: ${chunk.length} bytes                  ${'\x1b[0G'}`)
			})
			
			inputStream.on("error", chunk => {
				logger.info(e.toString())
				reject(error)
			})
			
			inputStream.on("end", chunk => {
				logger.info(`${destPath}/${file.name} downloaded`)
				destStream.end()
				resolve(`${destPath}/${file.name}`)
			})	

			inputStream.pipe(destStream)

		})

	}


	// async downloadFile(fileId) {
	// 	  try {
	// 	    const file = await drive.files.get({
	// 	      fileId: fileId,
	// 	      alt: 'media',
	// 	    });
	// 	    // console.log(file)
	// 	    return file.data;
	// 	  } catch (err) {
	// 	    throw err;
	// 	  }
	// }

	async exportFile(fileId, filePath){
		return new Promise(async (resolve, reject) => {
			let dest = fs.createWriteStream(filePath)
			
			let res = await drive.files.get(
			    { fileId, alt: 'media' },
			    { responseType: 'stream' }
			)

			res.data
			      .on('end', () => {
			        resolve()
			        console.log('Done downloading file.');
			      })  
			      .on('error', err => {
			        console.error('Error downloading file.');
			      })  
			      .on('data', d => {
			        // d+='';
			        // console.log(d);
			        //data will be here
			        // pipe it to write stream
			      })  
			      .pipe(dest);
		})
		
	}

	async geFiletWriteStream(file){
		// console.log(file)
		let res = await this.$drive.files.get(
		    { fileId: file.id, alt: 'media' },
		    { responseType: 'stream' }
		)
		
		return res.data
	}

	async getFile(file){
		let res = await this.$drive.files.get(
		    { fileId: file.id, alt: 'media' },
		    { responseType: 'stream' }
		)
		
		return res
	}

	async createFolderbyPath(rootFolder, path){
		
		let rootes = rootFolder.split("/")
		rootes = rootes.map((part, index) => rootes.slice(0,index+1))
		let partitions = (path) ? path.split("/") : []
		partitions = partitions.map((part, index) => rootFolder.split("/").concat(partitions.slice(0,index+1)))
		partitions = rootes.concat(partitions)

		let current
		
		for(let i=0; i < partitions.length; i++){

			let part = partitions[i]
			
			current = this.list(part.join("/"))[0]

			if(!current){
				
				let parent = (part.slice(0,-1).join("/")) ? this.list(part.slice(0,-1).join("/"))[0] : null

				current = await this.$drive.files.create({
				  resource: {
				    name: last(part),
				    mimeType: 'application/vnd.google-apps.folder',
				    parents: (parent) ? [ parent.id ] : undefined,
				  },
				  fields: "id",
				})

				current = extend({}, current.data, {
					name: last(part),
					mimeType: 'application/vnd.google-apps.folder',
				    parents: (parent) ? [ parent.id ] : undefined,
				})

				current.path = getPath(this.$filelist, current)
				this.$filelist.push(current)

			}
		}
		return current
	}


	async uploadFile(sourcePath, targetPath){
		
		let size = 0
		let oldSize = 0
		

		let destFolder = await this.createFolderbyPath(targetPath, '')
		
		const resource = {
		    name: path.basename(sourcePath),
		    // parents: [destFolder.id]
		}

		const body = fs.createReadStream(sourcePath)
		
		body.on("data", chunk => {
			size += chunk.length / 1024 / 1024 
			if( (size - oldSize) > 0.2 ){
				process.stdout.write(`Received: ${size.toFixed(1)} Mb ${'\x1b[0G'}`)
				// console.log(`\rReceived ${size} bytes`)
				oldSize = size	
			}
		})		

		const media = {
		  	mimeType: getMIMEType(path.basename(sourcePath)),
			body 
		}

		let cloned
		
		const existed = this.list(`${destFolder.path}/${path.basename(sourcePath)}`)[0]
		if(existed){
			// console.log("UPDATE", `${destFolder.path}/${path.basename(source.path)}`, destFolder)
			cloned =  await this.$drive.files.update({
				fileId: existed.id,
				resource,
				media,
				fields: "id",
			})

		} else {
			// console.log("CREATE", `${destFolder.path}/${path.basename(source.path)}`, destFolder)
			resource.parents = [destFolder.id]
			cloned =  await this.$drive.files.create({
				  resource,
				  media,
				  fields: "id",
			})

		}		
		
		cloned  = await this.$drive.files.get({ 
			fileId: cloned.data.id, 
			fields: 'id, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size' 
		})

		cloned = cloned.data
		cloned.path = getPath(this.$filelist, cloned)
		this.$filelist.push(cloned)

	}


	upload(source) {
		
		return new Promise( async (resolve, reject) => {
		
			
			let rawSize = 0
			let size = 0
			let oldSize = 0
			
			let cloned = await this.getFile(source)
			
			// cloned.data.on("data", chunk => {
			// 	rawSize += chunk.length
			// 	size += chunk.length / 1024 / 1024 
			// 	if( (size - oldSize) > 0.2 ){
			// 		// process.stdout.write(`Upload: ${rawSize} bytes                                                 ${'\x1b[0G'}`)
			// 		oldSize = size	
			// 	}
			// })


			cloned.data.on("error", error => {
				logger.info(error.toString())
				reject(error)
			})

			// cloned.data.on("end", () => {
			// 	logger.info(`UPLOAD ${rawSize} from ${source.size} bytes                                                      `)
			// })

			resolve(cloned.data)
		}

	)}

	async copyFile(source, targetDrive, targetPath){
		
		let destFolder = await targetDrive.createFolderbyPath(targetPath, path.dirname(source.path))
		const existed = targetDrive.list(`${destFolder.path}/${path.basename(source.path)}`)[0]
		
		if( existed && source.size == existed.size){
			logger.info(`${destFolder.path}/${path.basename(source.path)} already exists.`)
			return {}
		}

		if(existed){
			logger.info(`${destFolder.path}/${path.basename(source.path)} already exists but expected size ${existed.size} not equal ${source.size}`)
				
		}

		let cloned
		let clonedData = await this.upload(source)

		const resource = {
		    name: source.name,
		}

		const media = {
		  	mimeType: source.mimeType,
			body: clonedData,
		}

		
		try {
		
			if(existed){
		
				logger.info(`Delete previus: ${destFolder.path}/${path.basename(source.path)}`)
				cloned =  await targetDrive.delete(existed)
		
			}
		
		} catch (e){
			
			logger.info(e.toString())
		
		}
		
		// await delay(1000, "complete operation")

		logger.info (`Create: ${destFolder.path}/${path.basename(source.path)}`)
		resource.parents = [destFolder.id]
		
		cloned =  await targetDrive.$drive.files.create({
			  resource,
			  media,
			  fields: "id",
			},
	    	{
		      onUploadProgress: evt => {
		      	process.stdout.write(`UPLOAD: ${evt.bytesRead} from ${source.size} (${(100*evt.bytesRead/source.size).toFixed(2)}%) ${'\x1b[0G'}`)
		    }
	    })
		

		logger.info(`Status: ${cloned.status} ${cloned.statusText}                                                             `)
		// logger.info(`Validate file size...`)

		// await delay(1000, "complete operation")
		cloned  = await targetDrive.$drive.files.get({ 
			fileId: cloned.data.id, 
			fields: 'id, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size' 
		})

		cloned = cloned.data
		cloned.path = getPath(targetDrive.$filelist, cloned)
		targetDrive.$filelist.push(cloned)
		
		if(cloned.size == source.size && cloned.md5Checksum == source.md5Checksum){
			// logger.info(`Validate successful`)
		} else {
			logger.info(`File size "${cloned.path}" failed: ${source.size} bytes expected but ${cloned.size} bytes saved`)
			logger.info(`For file recovery use command: npm run recovery "${source.path}"`)
		}

	}

	async delete(file){
		let res = await this.$drive.files.delete({
			fileId: file.id
		})
		return res
	}


	async copy(sourcePath, targetDrive, targetPath){

		let cloned = this.fileList(sourcePath)

		// logger.info(`${cloned.length} items:`)

		for(let i=0; i < cloned.length; i++){
				// await delay(3000, "next operation")
				logger.info(`Copy ${cloned[i].path} into ${targetPath}`)
				
				try {
					
					await this.copyFile(cloned[i], targetDrive, targetPath)
				
				} catch (e) {
					logger.info(`${e.toString()}`)
				}
		}
		
	}	

}


const create = async options => {
	
	options = options || {}
	options.subject = options.subject || null
	options.noprefetch =  options.noprefetch || false
	options.root = options.root || ""
	
	const jwtClient = new google.auth.JWT(
	  key.client_email,
	  null,
	  key.private_key,
	  ["https://www.googleapis.com/auth/drive"],
	  options.subject
	);

	const drive = google.drive({version: 'v3', auth: jwtClient});

	logger.info(`Use Google Drive client account: ${key.client_email} (project:${key.project_id}) impersonated as ${options.subject || key.client_email}`)

	if(options.noprefetch == true){
		return new Drive(drive, [], options.subject)
	} else {
		// let filelist = await getDirList(drive)
		// console.log(JSON.stringify(filelist, null, " "))
		return new Drive(drive, [], options.subject)
	}

}


module.exports = options => {
	options = options || {}
	logger = options.logger || console
	
	return {
		create
	}	

}




