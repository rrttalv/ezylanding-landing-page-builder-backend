import mongoose, { Schema } from 'mongoose'

const TemplateSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user'
  },
  templateId: {
    type: String,
    required: true
  },
  frameworkId: {
    type: String
  },
  publicTemplate: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

const Template = mongoose.model('Template', TemplateSchema)

export const createTemplate = async (user, templateId, frameworkId) => {
  return await Template.create({
    user,
    templateId,
    frameworkId
  })
}

export default Template