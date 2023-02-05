const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore } = require('firebase-admin/firestore');

const path = require("path");

const serviceAccount = require(path.join(__dirname,'../../.config/key/fb/fb.key.json'));


const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `gs://${serviceAccount.project_id}.appspot.com`
});

const bucket = getStorage(app).bucket();
const db = getFirestore(app);

let collections = []

const getCollectionItems = async (collectionName, selector) => {

  try {
    const isGroup = collections.includes(collectionName)  
    selector = selector || []

    if(collections.includes(collectionName.split("/")[0])) {
      let query = db.collection(collectionName)
      selector.forEach( s => {
        if (s && s.length == 3) query = query.where(...s)  
      })
       
      const querySnapshot = await query.get();
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
    } else {
      let query = db.collectionGroup(collectionName)
      selector.forEach( s => {
        if (s && s.length == 3) query = query.where(...s)  
      })
      const querySnapshot = await query.get();
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        path: doc._ref._path.segments,
        ...doc.data()
      }))
    }  
  } catch(e) {
    console.log(e.toString())
    throw e
  }     
}

const uploadFile = async (filepath, filename) => {
  
  try {
    
    let res = await bucket.upload(filepath, {
      gzip: true,
      destination: filename,
      metadata: {
        contentType: 'audio/x-wav'
      }
    })

    res = await res[0].getSignedUrl({
      action: 'read',
      expires: new Date().setFullYear(new Date().getFullYear() + 2)
    })

    return res

  } catch(e) {
    console.log('Retry');
    return uploadFile(filepath, filename);
  }

}

const saveFileFromStream = (filename, file, stream) => {
  return new Promise((resolve,reject) => {
    stream
      .pipe(bucket.file(filename).createWriteStream({
        gzip: true,
        metadata: {
          contentType: file.mimeType
        }
      }))
      .on('finish', async () => {
        
        let res = await bucket.file(filename).getSignedUrl({
          action: 'read',
          expires: new Date().setFullYear(new Date().getFullYear() + 2)
        })
        
        resolve(res)
      })  
      .on('error', err => {
        reject(err)
      })
    
  })
}  
  

const saveFile = async (filename, data) => {
  try {


    let res = await bucket.file(filename).save(data, {
      gzip: true,
      metadata: {
        contentType: 'audio/x-wav'
      }
    })

    res = await bucket.file(filename).getSignedUrl({
      action: 'read',
      expires: new Date().setFullYear(new Date().getFullYear() + 2)
    })

    return res

  } catch(e) {
    console.log(e.toString())
    console.log('Retry');
    return saveFile(filename, data);
  }

}


const downloadFile = async (srcFilename, destFilename) => {
  const options = {
    destination: destFilename,
  };

  return bucket.file(srcFilename).download(options);
}





module.exports = async () => {
  collections = await db.listCollections()
  collections = collections.map(d => d.id)
  // console.log(collections)
  
  return {
    db,
    bucket,
    execute:{
      getCollectionItems,
      uploadFile,
      downloadFile,
      saveFile,
      saveFileFromStream  
    }
  }

} 


