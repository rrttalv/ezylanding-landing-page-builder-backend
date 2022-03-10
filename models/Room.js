import mongoose, { Schema } from 'mongoose'

const RoomSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user'
  },
  socketId: {
    type: String
  },
  roomId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

const Room = mongoose.model('Room', RoomSchema)

export default Room

export const createRoom = async (user, roomId, socketId) => {
  return await Room.create({
    user,
    roomId,
    socketId
  })
}

export const destroyRoom = async (socketId) => {
  return await Room.deleteOne({ socketId })
}
