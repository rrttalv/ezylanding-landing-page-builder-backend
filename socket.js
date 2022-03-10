const { createRoom, destroyRoom, default: Room } = require("./models/Room")
const { createTemplate, default: Template } = require("./models/Template")

let io = null
const rooms = {}

const joinRoom = async (socket, userId, roomId) => {
  const room = await createRoom(userId, roomId, socket.id)
  socket.join(roomId)
  console.log(room)
}

const saveTemplate = async (socket, userId, templateId, pages, cssFiles, palette, framework) => {
  try{
    //look for the template if it doesnt exist create one
    let existingTemplate = await Template.findOne({ templateId })
    const room = await Room.findOne({ socketId: socket.id })
    if(!existingTemplate){
      existingTemplate = await createTemplate(userId, templateId, framework.id)
    }
    io.sockets.to(room.roomId).emit('templateSaved', JSON.stringify(existingTemplate))
  }catch(err){
    console.log(err)
    //emit error to room
  }
}

const leaveRoom = async (socket) => {
  const room = await Room.findOne({ socketId: socket.id })
  await destroyRoom(socket.id)
}


const setSocket = (socket) => {
  io = socket
  io.sockets.on("connection", (socket) => {
    socket.on('roomInit', ({ roomId }) => joinRoom(socket, null, roomId))
    socket.on('saveTemplate', (userId, templateId, pages, css, palette, framework) => saveTemplate(socket, userId, templateId, pages, css, palette, framework))
    socket.on('disconnect', () => leaveRoom(socket))
  })
  
  return io
}

const getSocket = () => {
  if(!io){
    return null
  }
  return io
}

module.exports = { setSocket, getSocket }