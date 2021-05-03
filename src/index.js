const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

const adminName = 'Admin'

io.on('connection', (socket) => {
    console.log('New WebSocket Connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options})
        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage(adminName, 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage(adminName, `${user.username} has joined!`))
        io.to(user.room).emit('roomData', { 
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if(filter.isProfane(message)) {
            return callback('Profanity is not allowed')
        }
        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', ({latitude, longitude}, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `${process.env.MAP_URL}?q=${latitude},${longitude}`))
        callback('Location shared!')
    })
    
    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
       
        if(user) {
            io.to(user.room).emit('message', generateMessage(adminName, `${user.username} has left!`))
            io.to(user.room).emit('roomData', { 
                room: user.room,
                users: getUsersInRoom(user.room)
            })
    
        }
    })

})

server.listen(port, () => {
    console.log(`Serve is running on port ${port}!`)
})

