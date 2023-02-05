
const { google } = require("googleapis")
const path = require("path")
const fs = require("fs")
const { find, isUndefined, extend } = require("lodash")
const nanomatch = require('nanomatch')


const key = require("../../.config/key/gd/gd.key.json")

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

}

module.exports = async () => {
	let filelist = await getDirList()
	return new Drive(filelist)
}




