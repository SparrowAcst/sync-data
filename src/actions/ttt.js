
const run = async () => {
  let d = [1000,500, 2000]

  await Promise.all( d.map( async (data, index) => {
    await (async v => {
      for(let i = 0; i<v; i++){}
      console.log(index)  
    })(data)
  }))  
}

run()

