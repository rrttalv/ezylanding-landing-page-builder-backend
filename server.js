import dotenv from 'dotenv'
import api from './routes/api'
import auth from './routes/auth'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import passport from 'passport'
require("./utils/passport")(passport);
import { setSocket } from './socket'
import session from 'express-session'
const MongoStore = require("connect-mongo")

const app = express()
const httpServer = require("http").createServer(app)

dotenv.config()
const port = 4000 || process.env.PORT

const { MONGO_STRING } = process.env

const clientPromise = mongoose.connect(MONGO_STRING, { useNewUrlParser: true, useUnifiedTopology: true }).then(conn => conn.connection.getClient())
const db = mongoose.connection
db.on('error', e => {
  console.log(e)
})
db.once('open', () => {
  // we're connected !
  console.log('Mongodb Connection Successful')
})

app.use('/api/stripe/webhook', express.raw({type: 'application/json'}))
app.use(express.json())

app.use(
  cors(
    { 
      credentials: true, 
      origin: [new URL('http://localhost:3000').origin]
    }
  )
)

const sessionStore = MongoStore.create({
  clientPromise: clientPromise,
  dbName: process.env.DB_NAME,
  stringify: false
})

const sessionMiddleware = session({
  store: sessionStore,
  secret: 'asdasda',
  saveUninitialized: false,
  resave: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, domain: 'localhost', secure: false },
})

const io = require("socket.io")(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST']
  }
})

const wrap = middleware => (socket, next) => middleware(socket.request, {}, next)

io.of('/').use(wrap(sessionMiddleware))
io.of('/').use(wrap(passport.initialize()))
io.of('/').use(wrap(passport.session()))

io.use((socket, next) => {
  next()
});

setSocket(io)

app.use(sessionMiddleware)
app.use(passport.initialize())
app.use(passport.session())

app.use('/api', api)
app.use('/auth', auth)

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