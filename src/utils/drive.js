


const { google } = require("googleapis")
const path = require("path")
const fs = require("fs")
const { find, isUndefined, extend, last } = require("lodash")
const nanomatch = require('nanomatch')

const key = require(path.join(__dirname,"../../.config/key/gd/gd.key.json"))

const jwtClient = new google.auth.JWT(
  key.client_email,
  null,
  key.private_key,
  ["https://www.googleapis.com/auth/drive"],
  null
);

const drive = google.drive({version: 'v3', auth: jwtClient});

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

const getList = files => files.map( f => extend(f, { path: getPath(files,f) }))

async function getDirList() {
  try {
  	let res = []
  	let nextPageToken
  	do {
  		const part = await drive.files.list({
	      pageSize: 250,
	      pageToken: nextPageToken || "",	
	      fields: "files(id, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size ), nextPageToken",
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
					res.push([filelist[i], filelist[j]])
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
		    console.log(file)
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
		let partitions = path.split("/")
		partitions = partitions.map((part, index) => rootFolder.split("/").concat(partitions.slice(0,index+1)))
		partitions = rootes.concat(partitions)
		
		let current
		
		for(let i=0; i < partitions.length; i++){

			let part = partitions[i]
			
			current = this.list(part.join("/"))[0]

			if(!current){
				
				let parent = this.list(part.slice(0,-1).join("/"))[0]
		
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

	async copyFile(source, targetPath){
		
		
		let size = 0
		let oldSize = 0
		let cloned = await this.getFile(source)
		
		cloned.data.on("data", chunk => {
			size += chunk.length / 1024 / 1024 
			if( (size - oldSize) > 0.2 ){
				process.stdout.write(`Received: ${size.toFixed(1)} Mb ${'\x1b[0G'}`)
				// console.log(`\rReceived ${size} bytes`)
				oldSize = size	
			}
		})
		
		let destFolder = await this.createFolderbyPath(targetPath, path.dirname(source.path))
		

		const resource = {
		    name: source.name,
		    // parents: [destFolder.id]
		}

		const media = {
		  	mimeType: source.mimeType,
			body: cloned.data,
		}

		const existed = this.list(`${destFolder.path}/${path.basename(source.path)}`)[0]
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

	async copy(sourcePath, targetPath, logger){
		logger = logger || console
		let cloned = this.fileList(sourcePath)
		logger.info(`${cloned.length} items:`)
		for(let i=0; i < cloned.length; i++){
			logger.info(`Backup ${cloned[i].path}`)
			await this.copyFile(cloned[i], targetPath)
		}
	}	

}

module.exports = async () => {
	let filelist = await getDirList()
	return new Drive(filelist)
}




