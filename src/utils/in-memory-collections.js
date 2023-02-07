const {getFileList, makeDir, writeFile} = require("./file-system")
const path = require("path")
const {isUndefined, keys, find, extend, isArray, isString} = require("lodash")


let $collections = {}

const getCollection = name => {

	// if(isString($collections[name])){
	// 	$collections[name] = new Collection( name, require($collections[name]) )
	// 	console.log(`>>> load ${name}`)
	// } 
	
	return $collections[name]
}


const getParentRef =  item => {
	if(item.path) return {
		collection: item.path[0],
		id: item.path[1]
	}
	// if(item.$path) return {
	// 	collection: item.$path[0],
	// 	id: item.$path[1]
	// }
}

const getParent = item => {
	const ref = getParentRef(item)
	// console.log(item, ref)
	const refCol = getCollection(ref.collection)
	return find(refCol.values, d => d.id == ref.id)
}

const getChilds = (item, ...collections) => {
	let res = {}
	collections.forEach( c => {
		res[c] = find(getCollection(c).values, d => getParentRef(d).id == item.id)
	})
	return res
}

const lookupItem = (item, target, modifier) => {
	target = getCollection(target).values
	let t = find(target, d => modifier(item, d) )
	if(t){
		item = extend(item, modifier(item,t))
	}
	return item
}


const Collection  = class {
	
	constructor(name, values){
		this.name = name
		this.values = values || []
		this.values = (isArray(this.values)) ? this.values : [this.values]
	}

	find(selector){
		return find(this.values, selector)
	}
	
	lookup(target, modifier){
		this.values.forEach( d => {
			d = lookupItem(d, target, modifier)
		})
		return this
	}

	transform(mapper){
		this.values = this.values.map(mapper)
		return this
	}

	clone(name){
		console.log(">> clone ", name)
		$collections[name] = new Collection( name, this.values.map( d => d))
		return $collections[name]
	}

	select(selector){
		this.values = this.values.filter(selector)
		return this
	}

}




module.exports =  () => {
	// let fileList = await getFileList(pathToCollections)
	// fileList.forEach( f => {
	// 	const name = path.basename(f, '.json')
	// 	$collections[name] = path.resolve(f)
	// 	// normalizeCollection( require(path.resolve(f)))
	// })
	return {
		
		// save: async (outputPath, ...collections) => {
		// 	outputPath = path.resolve(outputPath)
		// 	await makeDir(outputPath)
			
		// 	collections = collections || []
		// 	collections = (collections.length == 0) ? keys($collections) : collections 
		// 	collections.forEach( coll => {
		// 		console.log(`Save ${outputPath}/${coll}.json `)
		// 		writeFile(path.resolve(`${outputPath}/${coll}.json`), JSON.stringify($collections[coll].values, null, " "))
		// 	})
		// },
		
		listCollections: () => keys($collections),
		
		collection: getCollection,
		
		addCollection: (name, values) => {
			console.log(">> add ", name)
			$collections[name] = new Collection(name, values) 
		},	
		
		getParentRef,
		getParent,
		getChilds,
		lookupItem
	}	
}
