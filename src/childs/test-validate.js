const { fork } = require("child_process")


let organization = process.argv[2] || ""
if(organization){
  const child = fork("./src/childs/validate-data")
  
  child.on('message', result => {
    console.log('Parent process received:', result.data);
  })
  
  child.on('error', error => {
    console.log('Parent process received:', error);
  })
  
  child.on('close', code => {
    console.log(`child process exited with code ${code}`);
  })
  
  child.send({ organization });

} else {

  console.log("Company data validation script: Organization undefined.")
  console.log("usage:\nnpm run validate <organization>")

}  
