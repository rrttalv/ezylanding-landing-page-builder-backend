import mongoose, { Schema } from 'mongoose'

const AssetSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user'
  },
  name: {
    type: String
  },
  deleted: {
    type: Boolean,
    default: false
  },
  extension: {
    type: String
  },
  mimeType: {
    type: String
  },
  originalName: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

const Asset = mongoose.model('Asset', AssetSchema)

export default Asset

export const saveAsset = async (user, name, extension, originalName) => {
  return await Asset.create({
    user,
    name,
    extension,
    originalName
  })
}
