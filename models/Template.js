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
  listed: {
    type: Boolean,
    default: false
  },
  pageLength: {
    type: Number,
    default: 1
  },
  categories: {
    type: [{
      type: String
    }]
  },
  downloads: {
    type: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  title: {
    type: String,
    default: 'New template'
  },
  tags: {
    type: [{
      type: String
    }]
  },
  updatedAt: {
    type: Date
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