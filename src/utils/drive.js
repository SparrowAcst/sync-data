


const { google } = require("googleapis")
const path = require("path")
const { getMIMEType } = require('node-mime-types')
const fs = require("fs")
const { find, isUndefined, extend, last, uniqBy, maxBy } = require("lodash")
const nanomatch = require('nanomatch')
const YAML = require("js-yaml")

const key = require(path.join(__dirname,"../../.config/key/gd/gd.key.json"))

const jwtClient = new google.auth.JWT(
  key.client_email,
  null,
  key.private_key,
  ["https://www.googleapis.com/auth/drive"],
  null
);

const drive = google.drive({version: 'v3', auth: jwtClient});


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

async function getDirList() {
  try {
  	let res = []
  	let nextPageToken
  	do {
  		const part = await drive.files.list({
  		  pageSize: 250,
	      pageToken: nextPageToken || "",	
	      fields: "files(id, webViewLink, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size, trashed, version ), nextPageToken",
	      spaces: 'drive',
	    });	
	    res = res.concat(part.data.files)
	    nextPageToken = part.data.nextPageToken
  	} while (nextPageToken)
    
    return getList(res);

  } catch (err) {
    console.log(err.toString())
    throw err;
  }
}


const Drive = class {
	
	constructor (filelist) {
		this.$filelist = filelist || []
	}

	async initiate(query){

		const filelist = this.list(query)
		console.log(this.$filelist.length, filelist.length)
		return new Drive(filelist)

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

	async downloadFile(fileId) {
		  try {
		    const file = await drive.files.get({
		      fileId: fileId,
		      alt: 'media',
		    });
		    // console.log(file)
		    return file.data;
		  } catch (err) {
		    throw err;
		  }
	}

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
		let res = await drive.files.get(
		    { fileId: file.id, alt: 'media' },
		    { responseType: 'stream' }
		)
		
		return res.data
	}

	async getFile(file){
		let res = await drive.files.get(
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
			// console.log("current", current)

			if(!current){
				
				let parent = this.list(part.slice(0,-1).join("/"))[0]
				// console.log("parent", parent)
				current = await drive.files.create({
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
			cloned =  await drive.files.update({
				fileId: existed.id,
				resource,
				media,
				fields: "id",
			})

		} else {
			// console.log("CREATE", `${destFolder.path}/${path.basename(source.path)}`, destFolder)
			resource.parents = [destFolder.id]
			cloned =  await drive.files.create({
				  resource,
				  media,
				  fields: "id",
			})

		}		
		
		cloned  = await drive.files.get({ 
			fileId: cloned.data.id, 
			fields: 'id, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size' 
		})

		cloned = cloned.data
		cloned.path = getPath(this.$filelist, cloned)
		this.$filelist.push(cloned)

	}


	upload(source) {
		return new Promise( async (resolve, reject) => {
		
		let result = {}
		
		let rawSize = 0
		let size = 0
		let oldSize = 0
		
		let cloned = await this.getFile(source)
		
		cloned.data.on("data", chunk => {
			rawSize += chunk.length
			size += chunk.length / 1024 / 1024 
			if( (size - oldSize) > 0.2 ){
				process.stdout.write(`Received: ${size.toFixed(1)} Mb ${'\x1b[0G'}`)
				// console.log(`\rReceived ${size} bytes`)
				oldSize = size	
			}
		})


		cloned.data.on("error", error => {
			logger.info(error.toString())
			result.error = error.toString()
			reject(error)
		})

		cloned.data.on("end", () => {
			let diff = source.size - rawSize
			
			console.log(`DOWNLOAD ${rawSize} from ${source.size}`)
			
			if(diff != 0) {
				result.error = `Difference size: ${diff}. Source: ${source.size}. Target: ${rawSize}`
			}
		})

		resolve(cloned.data)
	}

	)}


	async copyFile(source, targetPath){
		

		let cloned
		
		let destFolder = await this.createFolderbyPath(targetPath, path.dirname(source.path))
		
		let clonedData = await this.upload(source)






		const resource = {
		    name: source.name,
		    // parents: [destFolder.id]
		}

		const media = {
		  	mimeType: source.mimeType,
			body: clonedData,
		}

		const existed = this.list(`${destFolder.path}/${path.basename(source.path)}`)[0]
		
		try {
			if(existed){
				console.log("Delete previus ", `${destFolder.path}/${path.basename(source.path)}`, destFolder)
				cloned =  await drive.files.delete({
					fileId: existed.id
				})

			}
		} catch (e){
			console.log(e.toString())
		}
	
		console.log("Create", `${destFolder.path}/${path.basename(source.path)}`, destFolder)
		resource.parents = [destFolder.id]
		cloned =  await drive.files.create({
			  resource,
			  media,
			  fields: "id",
		})
		
		cloned  = await drive.files.get({ 
			fileId: cloned.data.id, 
			fields: 'id, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size' 
		})

		cloned = cloned.data
		
		result = extend( result, 
				(cloned.size == source.size && cloned.md5Checksum == source.md5Checksum)
						? {}
						: {
							source,
							target: cloned
						  }
		)				  

		cloned.path = getPath(this.$filelist, cloned)
		this.$filelist.push(cloned)
		
		return result
	}

	async copy(sourcePath, targetPath, logger){
		logger = logger || console
		let cloned = this.fileList(sourcePath)
		logger.info(`${cloned.length} items:`)
		let result = []
		let needRecivery = []
		
		for(let i=0; i < cloned.length; i++){
				await delay(10000, "next operation")
				logger.info(`Copy ${cloned[i].path} into ${targetPath}`)
				
				try {
					let r = await this.copyFile(cloned[i], targetPath)
					if(r.error){
						logger.info(`${r.error}`)
						needRecivery.push(cloned[i])
					} else {
						result.push(r)	
					}
							
				} catch (e) {
					logger.info(`${e.toString()}`)

					const about = await drive.about.get({
						fields:"*"
					})
					console.log(extend({}, {
						storageQuota: about.data.storageQuota,
						maxUploadSize: about.data.maxUploadSize
					}))
					
					needRecivery.push(cloned[i])
					await delay(10000, "after exception")
				}
		}

		logger.info(`${needRecivery.length} items will recovered/`)
		
		for(let i=0; i < needRecivery.length; i++){
			try {
				await delay(10000, "next operation")
				logger.info(`Recovery ${cloned[i].path}`)
				let r = await this.copyFile(needRecivery[i], targetPath)
				if(r.error){
					logger.info(`${r.error}`)
				} else {
					result.push(r)	
				}
						
			} catch (e) {
				logger.info(`${e.toString()}`)

				const about = await drive.about.get({
					fields:"*"
				})
				console.log(extend({}, {
					storageQuota: about.data.storageQuota,
					maxUploadSize: about.data.maxUploadSize
				}))
				await delay(10000, "after exception")
			}

		}	
		
		return result
	}	


	// async copy(sourcePath, targetPath, logger){
	// 	logger = logger || console
	// 	let cloned = this.fileList(sourcePath)
	// 	logger.info(`${cloned.length} items:`)
	// 	let result = []
	// 	for(let i=0; i < cloned.length; i++){
			
	// 			logger.info(`Backup ${cloned[i].path}`)
	// 			// await delay(1000, cloned[i].path)
	// 			try {
	// 				let r = await this.copyFile(cloned[i], targetPath)
	// 				if(r.error){
	// 					logger.info(`${r.error}`)
	// 					logger.info(`Recovery`)
	// 					r = await this.copyFile(cloned[i], targetPath)
	// 					logger.info(JSON.stringify(r, null, " "))
	// 				}
	// 				result.push(r)		
	// 			} catch (e) {

	// 			}


				
	// 		} catch (e) {
	// 			console.log(e.toString())
	// 			const about = await drive.about.get({
	// 				fields:"*"
	// 			})
	// 			console.log(extend({}, {
	// 				permissionId: about.data.permissionId,
	// 				storageQuota: about.data.storageQuota,
	// 				maxUploadSize: about.data.maxUploadSize
	// 			}))
	// 		}	
	// 	}
	// 	return result
	// }	

}

module.exports = async options => {

	console.log(`Google Drive client account: ${key.client_email} (project:${key.project_id})`)

	// let about = await drive.about.get({
	// 	fields:"*"
	// })

	// console.log("About Service:")
	// console.log(YAML.dump(about.data))

	
	options = options || {
		noprefetch: false
	}

	if(options.noprefetch == true){
		return new Drive([])
	} else {
		let filelist = await getDirList()
		// console.log(JSON.stringify(filelist, null, " "))
		return new Drive(filelist)
	}	

}




