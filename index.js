require('dotenv').config();
const cluster = require('cluster');
const { response } = require('express');
const {setup, sendRecord} = require('./producer');

setTimeout(() => {
  console.log('running setup')
  setup();
}, 5000);

// const { tracer, trackMiddleware } = require('./trace_utils');

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
  
    // Fork workers.
    for (let i = 0; i < process.env.WORKER_COUNT; i++) {
      cluster.fork();
    }
  
    cluster.on('exit', (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
    });
  } else {

    const express = require('express');
    const axios = require('axios');
    // measure response time of each request
    axios.interceptors.request.use(function (config) {
      config.metadata = { startTime: new Date()}
      return config;
    }, function (error) {
      return Promise.reject(error);
    });

    axios.interceptors.response.use(function (response) {
      response.config.metadata.endTime = new Date()
      response.duration = response.config.metadata.endTime - response.config.metadata.startTime
      return response;
    }, function (error) {
      error.config.metadata.endTime = new Date();
      error.duration = error.config.metadata.endTime - error.config.metadata.startTime;
      return Promise.reject(error);
    });
    const bodyParser = require('body-parser');
    const app = express();
    const port = process.env.PORT;

    //------------------------------------------
    const GlobalConfig = {'base': process.env.BASE_URL};
    app.get('/__config', async (req,res,next)=>{
      changes = []
      if (req.query.base_url){
        console.log('updating config')
        GlobalConfig['base'] = req.query.base_url;
        changes.push('base_url set to ' + req.query.base_url)        
      }
      res.send(changes)
    });
    //------------------------------------------

    app.use(bodyParser.json());

    app.use(async (req,res,next)=>{
        console.log('!')
        const config = {
            method: req.method,
            headers: req.headers,
        }

        if (! req.method.toLocaleLowerCase().localeCompare('get') == 0 ){
            config.data = req.body;
        }
        console.log(GlobalConfig['base'] + req.path);
        axios(GlobalConfig['base'] + req.path, config)
        .then((response)=>{
          sendRecord({
            httpMethod: req.method, 
            path: req.path, 
            httpCode: 200, 
            responseTime: response.duration
          });
          return res.send(response.data);
        })
        .catch((err)=>{
          console.log(err.message);
          sendRecord({
            httpMethod: req.method, 
            path: req.path, 
            httpCode: 500, 
            responseTime: err.duration
          });
          return res.status(500).send({message: err.message || "internal server err"});
        });
    });

    app.listen(port, () => {
      console.log(`Wrapper app listening at ${port}`)
    });
  }
