const mongo = require('mongodb').MongoClient
const { loadYaml } = require("./file-system")
const path = require("path")

const config = loadYaml(path.join(__dirname,"../../.config/db/mongodb.conf.yml"))
// console.log(config)

let client, db

const init = async () => {
	client = await mongo.connect(config.db.url, {
	    useNewUrlParser: true,
	    useUnifiedTopology: true
	})

	db = client.db(config.db.name)
}

// const getClient = async () => {
	
// 	if(!client){

// 		client = await mongo.connect(config.db.url, {
// 		    useNewUrlParser: true,
// 		    useUnifiedTopology: true
// 		})
	
// 	}

// 	return client
// }


const normalize = str => {
	str = str.split(".")
	return {
		dbName: str[0],
		collectionName: str[1]
	}
}	

const aggregate = async (collectionName, pipeline) => {
	
	// let client
	
	try {
		
		// client = await getClient()

		let conf = normalize(collectionName)
		let db = client.db(conf.dbName)
	    let collection = db.collection(conf.collectionName)
	    pipeline = pipeline || []
	    let res = await collection.aggregate(pipeline.concat([{$project:{_id:0}}])).toArray()
	    return res
	
	} catch (e) {
	
		throw e
	
	} finally {
	
		// if (client)  client.close()
	
	}    
}

const getAggregateCursor =  async (collectionName, pipeline) => {

	// let client
	
	try {
		
		// client = await getClient()

		let conf = normalize(collectionName)
		let db = client.db(conf.dbName)
	    let collection = db.collection(conf.collectionName)
	    pipeline = pipeline || []
	    let res = collection.aggregate(pipeline.concat([{$project:{_id:0}}]))
	    return res

	} catch (e) {
	
		throw e
	
	} finally {
	
		// if (client)  client.close()
	
	}     
}

const removeAll = async (collectionName) => {
	
	// let client
	
	try {
		
		// client = await getClient()

		let conf = normalize(collectionName)
		let db = client.db(conf.dbName)
	    let collection = db.collection(conf.collectionName)
	    await collection.deleteMany({})
	
	} catch (e) {
	
		throw e
	
	} finally {
	
		// if (client)  client.close()
	
	}	    
} 

const insertAll = async (collectionName, data) => {
	
	// let client
	
	try {
		
		// client = await getClient()

		let conf = normalize(collectionName)
		let db = client.db(conf.dbName)
	    let collection = db.collection(conf.collectionName)

		await collection.insertMany(data)

	} catch (e) {
	
		throw e
	
	} finally {
	
		// if (client)  client.close()
	
	}	
}

const bulkWrite = async (collectionName, commands) => {
	
	// let client
	
	try {
		
		// client = await getClient()

		let conf = normalize(collectionName)
		let db = client.db(conf.dbName)
	    let collection = db.collection(conf.collectionName)
		await collection.bulkWrite(commands)

	} catch (e) {
	
		throw e
	
	} finally {
	
		// if (client)  client.close()
	
	}	
}

const replaceOne = async (collectionName, filter, data) => {
	
	
	// let client
	
	try {
		
		// client = await getClient()

		let conf = normalize(collectionName)
		let db = client.db(conf.dbName)
	    let collection = db.collection(conf.collectionName)
	    await collection.replaceOne(filter, data, {upsert: true})
	} catch (e) {
	
		throw e
	
	} finally {
	
		// if (client)  client.close()
	
	}    
}

const updateOne = async (collectionName, filter, data) => {

	// let client
	
	try {
		
		// client = await getClient()

		let conf = normalize(collectionName)
		let db = client.db(conf.dbName)
	    let collection = db.collection(conf.collectionName)
	    await collection.updateOne(filter, { $set:data }, { upsert: true })

	} catch (e) {
	
		throw e
	
	} finally {
	
		// if (client)  client.close()
	
	}        
}

const listCollections = async dbSchema => {

	// let client
	
	try {
	
		// let client = await getClient()

			
		let conf = normalize(dbSchema)
		const res =  await client
						.db(conf.dbName)
	    				.listCollections()
	    				.toArray()

		return res
	
	} catch (e) {
	
		throw e
	
	} finally {
	
		// if (client)  client.close()
	
	}		
	
}



module.exports =  async () => {
	await init()
	
	return {
		client,
		db,
		config,

		close: () => {
			if(client){
				client.close()
			}
		},
		
		execute:{
			aggregate,
			removeAll,
			insertAll,
			replaceOne,
			updateOne,
			bulkWrite,
			listCollections,
			getAggregateCursor	
		}
		
	}
}