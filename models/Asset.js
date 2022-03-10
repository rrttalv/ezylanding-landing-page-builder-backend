import mongoose, { Schema } from 'mongoose'

const AssetSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user'
  },
  name: {
    type: String
  },
  path: {
    type: String
  },
  extension: {
    type: String
  },
  sourceName: {
    type: String
  }
})

const asset = mongoose.model('Asset', AssetSchema)

export default asset

export const saveAsset = async (user, name, extension, sourceName) => {
  return await asset.create({
    user,
    name,
    extension,
    sourceName
  })
}
