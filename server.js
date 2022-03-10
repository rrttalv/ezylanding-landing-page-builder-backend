import dotenv from 'dotenv'
import api from './routes/api'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import passport from 'passport'
import { setSocket } from './socket'

const app = express()
const httpServer = require("http").createServer(app)
const io = require("socket.io")(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})
setSocket(io)

dotenv.config()
const port = 4000 || process.env.PORT

const { MONGO_STRING } = process.env

mongoose.connect(MONGO_STRING, { useNewUrlParser: true, useUnifiedTopology: true })
const db = mongoose.connection
db.on('error', e => {
  console.log(e)
})
db.once('open', () => {
  // we're connected !
  console.log('Mongodb Connection Successful')
})

app.use(require('express').json())
app.use(cors())

//app.use(passport.initialize())
//app.use(passport.session())

app.use('/api', api)

app.use((err, req, res, next) => {
  if (typeof err === 'object') {
    res.status(400).json({
      message: 'something went wrong',
      error: true,  
      raw: JSON.stringify(err)
    })
    return
  }
  res.status(400).json({ 
    message: 'something went wrong',
    error: true,
    raw: err
  })
})

httpServer.listen(port)