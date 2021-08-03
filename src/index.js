#!node
'use strict'

// Load config from .env
require('dotenv').config()

// Load system/npm modules
const net	= require('net')
const WSs	= require('websocket').server
const exec	= require('child_process').exec
const path	= require('path')
const fs	= require('fs')

// Load custom modules
const http	= require('./http-server')
const log	= require('./utility').log
const scoretracker = require('./scoretracker')

// Global vars
var clientsWs	= []
var clientsTcp	= []
var readyTcp	= false
var readyWs		= false
var connID		= 0
var settings	= {
	theme: 'default'
}

const mediaPath = 'dist/assets/media/'
var themes		= loadThemes()

var tracker = new scoretracker()

// Create TCP socket server and set up event handling on it
var tcp = net.createServer((sock) => {
	sock.setEncoding('utf8')

	sock.on('connect', (sock) => {
		log.tcp('Mod connected!')
	})

	sock.on('data', (data) => {
		let message = decodeTCPMessage(data)
		log.tcp(`${message.cmd}: ${JSON.stringify(message.args)}`)

		// Scoreboard
		// TODO: Currently, all events are forwarded to WS, *and* full state is submitted
		// on every scoreboard change. This is bad. We should send the full state on 
		// connection, and then only delta updates.
		tracker.handleEvent(message)
		if (tracker.running) {
			var fullState = { cmd: 'scoreboard', args: [ tracker.getScoreboard() ] }
			clientsWs.forEach((client) => { client.send(JSON.stringify(fullState)) })

			// Handle media
			if (message.cmd === 'theme' && themes.includes(message.args[0])) {
				log.tcp(`Switched theme from '${settings.theme}' to '${message.args[0]}'.`)
				settings.theme = message.args[0]
			}

			if (getMedia(message.cmd)) {
				message.media = getMedia(message.cmd)
			}

			// Forward to WS clients
			clientsWs.forEach((client) => { client.send(JSON.stringify(message)) })
			log.ws(`Forwarded to ${clientsWs.length} clients.`)
		}
	})
	sock.on('error', (err) => {
		log.tcp(err)
	})
	
	clientsTcp.push(sock)
	sock.pipe(sock)
})

tcp.listen(process.env.PORT_TCP, () => {
	readyTcp = true
	log.tcp('Socket listening on ' + process.env.PORT_TCP)
})

http.listen(process.env.PORT_HTTP, (err) => {
	if (err)
		return log.tcp('http.listen() error: ' + err)

	log.http('Server listening on ' + process.env.PORT_HTTP)
})

var ws = new WSs({
	httpServer: http,
	autoAcceptConnections: false
})

ws.on('request', (req) => {
	let connection = req.accept('beercs', req.origin)
})

ws.on('connect', (conn) => {
	conn.id = connID++
	clientsWs[conn.id] = conn
	log.ws(`[${conn.id}] Connected from ${conn.socket.remoteAddress}.`)

	if (tracker.running) {
		log.ws('Sending full state.')
		var fullState = { cmd: 'scoreboard', args: [ tracker.getScoreboard() ] }
		conn.send(JSON.stringify(fullState))
	}

	conn.on('message', (data) => {
		log.ws(`[${conn.id}]: ${data}`)
	})

	conn.on('close', (reason, description) => {
		log.ws(`[${conn.id}] Disconnected.`)
	})
})

// Create object from "encoded" string
function decodeTCPMessage(msg) {
	let out = {}

	// If message uses old "encoding", turn into object.
	// Otherwise, assume it's JSON
	if (msg.includes("|€@!|")) {
		let split = msg.split("|€@!|")
			.filter((i) => { return i != '' })
		return { 'cmd': split.shift(), 'args': split }
	} else {
		return JSON.parse(msg)
	}
}

function getMedia(event) {
	let media = []
	try {
		media = fs.readdirSync(mediaPath + settings.theme + '/' + event)
		let random = media[Math.floor(Math.random() * media.length)]
		let path = `media/${settings.theme}/${event}/${random}`
		return path
	} catch (e) {
		log.tcp(`No media found for event '${event}'.`)
		return false
	}
}

function loadThemes() {
	let files = fs.readdirSync(mediaPath)
	let themes = []
	files.forEach((file) => {
		let stats = fs.statSync(mediaPath + file)
		if (stats.isDirectory()) {
			themes.push(file)
		}
	})

	return themes
}

// Helper functions
// RNG
function rng(min, max) {
	min = Math.floor(min)
	max = Math.floor(max) + 1
	return Math.floor(Math.random() * (max - min) + min)
}
