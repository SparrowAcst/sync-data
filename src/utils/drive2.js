
const { google } = require("googleapis")
const path = require("path")
const { getMIMEType } = require('node-mime-types')
const fs = require("fs")
const { find, findIndex, isUndefined, extend, last, uniqBy, maxBy } = require("lodash")
const nanomatch = require('nanomatch')
const YAML = require("js-yaml")

// const {getFolder} = require("./drive-helper")

const key = require(path.join(__dirname,"../../.config/key/gd/gd.key.json"))


let logger


/////////////////////////////////////////////////////////////////////////////////////////////////////


const FOLDER = "application/vnd.google-apps.folder";

  /**
 * create a drive file
 * @param {object} options createfile options
 * @param {string} options.name the file name
 * @param {string} [options.mimeType = "text/plain"] the mimetype
 * @param {Drive} options.client the authenticated client
 * @param {[string]} options.parents the id's of the parents (usually onlt 1)
 * @returns {File} response
 */
const createFile = ({
  name,
  mimeType = "text/plain",
  client,
  content,
  parents,
}) => {
  const requestBody = {
    name,
    mimeType,
  };
  if (parents) {
    if (!Array.isArray(parents)) parents = [parents];
    requestBody.parents = parents;
  }
  // we'll do this as a stream
  const options = {
    requestBody,
  };
  if (content) {
    const s = new Readable();
    s.push(content);
    s.push(null);

    options.media = {
      mimeType,
      body: s,
    };
  }

  return client.files.create(options);
};



/**
 * create a drive folder
 * @param {object} options createfile options
 * @returns {File} response
 */
const createFolder = (options) => createFile({ ...options, mimeType: FOLDER });



/**
 * get the id of a folder at the end of a path /a/b/c returns the drive file for c
 * @param {object} options  options
 * @param {string} options.path the path
 * @param {Drive} options.client the authenticated client
 * @returns {File} the parent folder at the end of the path
 */

const getFolder = async ({ client, path, createIfMissing = false}) => {
  let parent = null;
  for await (let folder of folderIterator({ client, path, createIfMissing })) {
    parent = folder;
  }
  return parent && parent[0];
};


/**
 *
 * @param {object} options
 * @param {string} options.path a path like '/'
 * @param {string} options.client the client to use
 * @param {boolean} options.createIfMissing whether to create missing folders if not in the path
 * @return {object} an iterator
 */
const folderIterator = ({ path = "", client, createIfMissing = false }) => {
  
  const extractFiles = (res) =>
    res &&
    res.data &&
    res.data.files &&
    res.data.files[0] &&
    res.data.files;
  


const getItem = async ({name, parents}) => {
	try {
		q = `name='${name}' and mimeType = '${FOLDER}' and trashed = false`;
    
    	if (parents) options.q  = q + ` and '${parents[0]}' in parents`;

	  	let res = []
	  	let nextPageToken
	  	do {
	
	  		const part = await client.files.list(
	  				{
			  		  q,
			  		  pageSize: 1000,
				      pageToken: nextPageToken || "",	
				      fields: "files(id, webViewLink, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size, trashed, version, owners ), nextPageToken",
				      spaces: 'drive'
				    }
			)		
		    res = res.concat(part.data.files)
		    nextPageToken = part.data.nextPageToken
	
	  	} while (nextPageToken)

	  	return {
	  		data:{
	  			files:res
	  		}
	  	}
  	
  	} catch (e) {
  		logger.info(e.toString())
    	throw e;
  	}
}


  // const getItem = ({ name, parents }) => {
  //   q = `name='${name}' and mimeType = '${FOLDER}' and trashed = false`;
  //   const options = {
  //     q,
  //     spaces: 'drive'
  //   };
  //   if (parents) options.q  = q + ` and '${parents[0]}' in parents`;

  //   return client.files
  //     .list(options)
  //     .then((res) => {
  //       return res;
  //     })
  //     .catch((error) => {
  //       console.log(error);
  //       return Promise.reject(error)
  //     });
  // };

  const paths = path.trim().replace(/^\//, "").replace(/\.$/, "").split("/");

  return {
    // will be selected in for await of..
    [Symbol.asyncIterator]() {
      return {
        paths,
        parents: null,
        ids: [],
        currentPath:[],

        hasNext() {
          return this.paths.length;
        },

        next() {
          if (!this.hasNext())
            return Promise.resolve({
              done: true,
            });

          const name = this.paths.shift();
          this.currentPath.push(name)
          process.stdout.write(`find path: ${this.currentPath.join("/")}                                                       ${'\x1b[0G'}`)
          const parents = this.parents && this.parents.map((f) => f.id);
          return getItem({ name, parents }).then((res) => {
            const value = extractFiles(res);
            this.parents = value;
            if (!value) {
              return (createIfMissing
                ? createFolder({
                    client,
                    name,
                    parents,
                  })
                : Promise.resolve(null)).then((res) => {
                    this.parents = res && [res.data];
                    if (!this.parents) {
                      // console.log("...couldnt find/create folder", name);
                      return Promise.reject(`\n...couldnt find/create folder ${name}                                                `);
                    } else {
                      console.log("...created folder                                                           ", name, this.parents)
                      return {
                        done: false,
                        value: this.parents ,
                      };
                    }
                })
            } else {
              return {
                done: false,
                value,
              };
            }
          });
        },
      };
    },
  };
};




/////////////////////////////////////////////////////////////////////////////////////////////////////

// const delay = (ms, msg) => new Promise(resolve => {
	
// 	let total = ms
// 	let delta = 1000
	
// 	process.stdout.write(`Wait Google Drive ${Math.round(ms/delta)}s for ${msg} ${'\x1b[0G'}`)
	
// 	let interval = setInterval(() => {
// 		ms -= delta
// 		process.stdout.write(`Wait Google Drive ${Math.round(ms/delta)}s for ${msg} ${'\x1b[0G'}`)
// 		if(ms <= 0){
// 			process.stdout.write(`${'\x1b[0G'}`)
// 			clearInterval(interval)
// 			resolve()	
// 		}
// 	}, delta)

// })



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


async function getTree ({ id, drive}) {
	
	let temp = []
	let prevs = []
	let currents = await loadList({drive, options:{q: `'${id}' in parents and trashed = false` }})
	
	for( let prevs =  currents.map(d => d); prevs.length > 0;  ) {
		
		temp = temp.concat(prevs)

		process.stdout.write(`build tree: ${temp.length} items                                        ${'\x1b[0G'}`)
          

		let nextWave = []
		for(let j=0; j< prevs.length; j++){
			let part = await loadList({drive, options:{q: `'${prevs[j].id}' in parents and trashed = false` }})
			nextWave = nextWave.concat(part)	
		}

		prevs = nextWave.map(d => d)
		
	}	
	

	return temp
}



const Drive = class {
	
	constructor (drive, filelist, subject) {
		this.$filelist = filelist || []
		this.$drive = drive
		this.$subject = subject
	}

	getFolder( {path, createIfMissing} ){
		return getFolder({
			client: this.$drive,
			path,
			createIfMissing
		})
	}

	async load(path) {

		let f 
		
		try {
			
			f = await this.getFolder({path})
		
		} catch(e){
			logger.info(e.toString())
		}	
		
		if(!f) {
			this.$filelist = []
			return 
		}	

		let files  = await getTree({
			drive: this.$drive,
			id: f.id
		})
		this.$filelist = getList(files)
		const prefix = path //.split("/").slice(0,-1).join("/")

		this.$filelist.forEach( f => {
			f.path = `${prefix}/${f.path}`
		}) 

	}

	// folders(path){
	// 	// selector = selector || ( d => true)
	// 	// return this.$filelist.filter( f => f.mimeType == "application/vnd.google-apps.folder").filter(selector)
	// 	// path = path || "**/*"
	// 	// const names = nanomatch(this.$filelist.map(f => f.path), path)
	// 	// return this.$filelist.filter(f => names.includes(f.path) && f.mimeType == "application/vnd.google-apps.folder")
	// }

	// files(selector){
	// 	selector = selector || ( d => true)
	// 	return this.$filelist.filter( f => f.mimeType != "application/vnd.google-apps.folder").filter(selector)
		
	// 	// path = path || "**/*.*"
	// 	// const names = nanomatch(this.$filelist.map(f => f.path), path)
	// 	// return this.$filelist.filter(f => names.includes(f.path) && f.mimeType != "application/vnd.google-apps.folder")
	// }

	// items(path){
	// 	return this.$filelist
	// 	// path = path || "**/*.*"
	// 	// const names = nanomatch(this.$filelist.map(f => f.path), path)
	// 	// return this.$filelist.filter(f => names.includes(f.path))
	// }

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
		
		
		let destFolder = await targetDrive.getFolder({
			path: targetPath,
			createIfMissing: true
		})
		destFolder.path = getPath(targetDrive.$filelist, destFolder)
		
		console.log(destFolder.path, " > ", path.basename(source.path))

		const existed = targetDrive.fileList(`${destFolder.path}/${path.basename(source.path)}`)[0]
		
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
		
		cloned  = await targetDrive.$drive.files.get({ 
			fileId: cloned.data.id, 
			fields: 'id, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size' 
		})

		cloned = cloned.data
		cloned.path = getPath(targetDrive.$filelist, cloned)
		targetDrive.$filelist.push(cloned)
		
		if(cloned.size == source.size && cloned.md5Checksum == source.md5Checksum){
		
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

		let cloned = this.files(f => f.path == sourcePath)

		for(let i=0; i < cloned.length; i++){
				
				// tp = `${path.dirname(cloned[i].path)}/${targetPath}`
		
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

	return new Drive(drive, [], options.subject)
	

}


module.exports = options => {
	options = options || {}
	logger = options.logger || console
	
	return {
		create
	}	

}




