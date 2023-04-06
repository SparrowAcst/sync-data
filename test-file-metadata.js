
const run  = async () => {

	  const controller = await require("./src/controller")({
	    firebaseService: 
	    {
	      noprefetch: true
	    },
	    
	    googledriveService: true,

	    mongodbService: false,
	  })

	  // let metadata = await controller.firebaseService.execute.getFileMetadata("9ASbG0DQawa2ajr0APjbqhVz8pG2/assets/files/9woWosw3l2L2WRMVjptb_POT0053.pdf")

	  // console.log(metadata)

	  // const drive = await controller.googledriveService.initiate("Ready for Review/Denis/**/*.*")

	  // console.log(drive.list())

}

run()