const { find } = require("lodash")

let listeners = []
let messages = []


const handleMessages = l => {

	const m = messages.slice(l.current, messages.length)
	
	l.cb({
		id: l.id,
		current: l.current,
		messages: m
	})

	l.current = messages.length
}

module.exports = {
	on: (id, cb) => {
		if( !find(listeners, d => d.id == id)){
			const l = {
				id,
				cb,
				current: 0
			}
			handleMessages(l)
			listeners.push(l)	
		}
	},
	
	emit: data => {
		messages = messages.concat(data.split("\n"))
		listeners.forEach( l => {
			handleMessages(l)
		})
	},
	
	clear: () => {
		messages = []
		listeners.forEach( l => {
			l.current = 0
		})
	}
}