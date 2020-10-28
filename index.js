require('dotenv').config();
const cluster = require('cluster');
const {tracer, trackMiddleware} = require('./trace_utils');
const { FORMAT_HTTP_HEADERS } = require('opentracing');

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
    const bodyParser = require('body-parser');
    const app = express();

    const port = process.env.PORT;
    const base = process.env.BASE_URL;

    app.use(bodyParser.json());
    // app.use(trackMiddleware("wrapper"))
    app.use((req,res,next)=>{
        const config = {
            method: req.method,
            headers: req.headers,
        }

        if (! req.method.toLocaleLowerCase().localeCompare('get') == 0 ){
            config.data = req.body;
        }
        
        const span = tracer.startSpan("backend");
        tracer.inject(span, FORMAT_HTTP_HEADERS, config.headers);
        axios(base + req.path, config)
        .then((response)=>{
            span.finish();
            return res.send(response.data);
        })
        .catch((err)=>{
            span.finish();
            console.log(err);
            return res.status(500).send({message: err.message || "internal server error"});
        });
    });

    app.listen(port, () => {
    console.log(`Wrapper app listening at ${port}`)
    });
  }
